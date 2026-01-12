import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ApiConfig {
  baseUrl: string;
  apiKey?: string;
  authType: "bearer" | "api-key" | "basic" | "none";
  endpoints: {
    contacts?: string;
    products?: string;
    orders?: string;
    activities?: string;
  };
}

export interface SyncResult {
  success: boolean;
  synced?: number;
  total?: number;
  errors?: string[];
  message?: string;
}

export function useCompanyApiSync() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<Record<string, SyncResult>>({});
  const { toast } = useToast();

  const testConnection = async (config: ApiConfig): Promise<boolean> => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Erreur",
          description: "Vous devez être connecté",
          variant: "destructive",
        });
        return false;
      }

      const { data, error } = await supabase.functions.invoke("company-api-sync", {
        body: { action: "test_connection", config },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Connexion réussie",
          description: "L'API de votre entreprise est accessible",
        });
        return true;
      } else {
        toast({
          title: "Échec de connexion",
          description: data.error || "Impossible de contacter l'API",
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      console.error("Test connection error:", error);
      toast({
        title: "Erreur",
        description: "Erreur lors du test de connexion",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const syncData = async (
    dataType: "contacts" | "deals" | "activities",
    config: ApiConfig
  ): Promise<SyncResult> => {
    setIsSyncing(true);
    setSyncStatus((prev) => ({ ...prev, [dataType]: { success: false, message: "En cours..." } }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Non authentifié");
      }

      const { data, error } = await supabase.functions.invoke("company-api-sync", {
        body: { action: "sync_data", config, dataType },
      });

      if (error) throw error;

      const result: SyncResult = {
        success: data.success,
        synced: data.synced,
        total: data.total,
        errors: data.errors,
        message: data.success
          ? `${data.synced}/${data.total} ${dataType} synchronisés`
          : data.error,
      };

      setSyncStatus((prev) => ({ ...prev, [dataType]: result }));

      toast({
        title: result.success ? "Synchronisation réussie" : "Erreur",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });

      return result;
    } catch (error) {
      console.error("Sync error:", error);
      const result: SyncResult = {
        success: false,
        message: error instanceof Error ? error.message : "Erreur de synchronisation",
      };
      setSyncStatus((prev) => ({ ...prev, [dataType]: result }));
      toast({
        title: "Erreur",
        description: result.message,
        variant: "destructive",
      });
      return result;
    } finally {
      setIsSyncing(false);
    }
  };

  const syncAll = async (config: ApiConfig) => {
    const types: Array<"contacts" | "deals" | "activities"> = ["contacts", "deals", "activities"];
    const results: Record<string, SyncResult> = {};

    for (const type of types) {
      results[type] = await syncData(type, config);
    }

    return results;
  };

  return {
    isLoading,
    isSyncing,
    syncStatus,
    testConnection,
    syncData,
    syncAll,
  };
}
