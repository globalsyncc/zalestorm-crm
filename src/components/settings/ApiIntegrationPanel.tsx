import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Settings, 
  Link, 
  RefreshCw, 
  Check, 
  X, 
  Users, 
  Package, 
  FileText, 
  Activity,
  ChevronRight,
  Loader2,
  Plug,
  Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useCompanyApiSync, ApiConfig } from "@/hooks/useCompanyApiSync";

interface ApiIntegrationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApiIntegrationPanel({ isOpen, onClose }: ApiIntegrationPanelProps) {
  const [config, setConfig] = useState<ApiConfig>({
    baseUrl: "",
    apiKey: "",
    authType: "bearer",
    endpoints: {
      contacts: "/contacts",
      products: "/products",
      orders: "/orders",
      activities: "/activities",
    },
  });
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["contacts", "deals", "activities"]);

  const { isLoading, isSyncing, syncStatus, testConnection, syncData, syncAll } = useCompanyApiSync();

  const handleTestConnection = async () => {
    setConnectionStatus("testing");
    const success = await testConnection(config);
    setConnectionStatus(success ? "success" : "error");
  };

  const handleSync = async (type: "contacts" | "deals" | "activities") => {
    await syncData(type, config);
  };

  const handleSyncAll = async () => {
    await syncAll(config);
  };

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const syncItems = [
    { id: "contacts", label: "Contacts", icon: Users, endpoint: "contacts" },
    { id: "deals", label: "Opportunités", icon: FileText, endpoint: "deals" },
    { id: "activities", label: "Activités", icon: Activity, endpoint: "activities" },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed right-0 top-0 h-full w-full max-w-lg bg-background border-l shadow-2xl z-50 overflow-y-auto"
        >
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Plug className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Intégration API Entreprise</h2>
                  <p className="text-sm text-muted-foreground">
                    Connectez vos données externes
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Connection Configuration */}
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Configuration
                </CardTitle>
                <CardDescription>
                  Paramètres de connexion à l'API de votre entreprise
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="baseUrl">URL de base de l'API</Label>
                  <Input
                    id="baseUrl"
                    placeholder="https://api.votreentreprise.com/v1"
                    value={config.baseUrl}
                    onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="authType">Type d'authentification</Label>
                    <Select
                      value={config.authType}
                      onValueChange={(value: ApiConfig["authType"]) =>
                        setConfig({ ...config, authType: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bearer">Bearer Token</SelectItem>
                        <SelectItem value="api-key">API Key</SelectItem>
                        <SelectItem value="basic">Basic Auth</SelectItem>
                        <SelectItem value="none">Aucune</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {config.authType !== "none" && (
                    <div className="space-y-2">
                      <Label htmlFor="apiKey">
                        {config.authType === "bearer" ? "Token" : "Clé API"}
                      </Label>
                      <Input
                        id="apiKey"
                        type="password"
                        placeholder="••••••••••••"
                        value={config.apiKey}
                        onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                      />
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Connexion sécurisée
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {connectionStatus === "success" && (
                      <Badge variant="default" className="bg-green-500">
                        <Check className="h-3 w-3 mr-1" />
                        Connecté
                      </Badge>
                    )}
                    {connectionStatus === "error" && (
                      <Badge variant="destructive">
                        <X className="h-3 w-3 mr-1" />
                        Erreur
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTestConnection}
                      disabled={!config.baseUrl || isLoading}
                    >
                      {connectionStatus === "testing" ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Link className="h-4 w-4 mr-2" />
                      )}
                      Tester
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Endpoints Configuration */}
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Endpoints API</CardTitle>
                <CardDescription>
                  Personnalisez les chemins pour chaque type de données
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {syncItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <Switch
                      checked={selectedTypes.includes(item.id)}
                      onCheckedChange={() => toggleType(item.id)}
                    />
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium w-24">{item.label}</span>
                    <Input
                      className="flex-1 h-8 text-sm"
                      placeholder={`/${item.endpoint}`}
                      value={config.endpoints[item.endpoint as keyof typeof config.endpoints] || ""}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          endpoints: {
                            ...config.endpoints,
                            [item.endpoint]: e.target.value,
                          },
                        })
                      }
                      disabled={!selectedTypes.includes(item.id)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Sync Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Synchronisation
                </CardTitle>
                <CardDescription>
                  Importez les données depuis votre API
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {syncItems
                  .filter((item) => selectedTypes.includes(item.id))
                  .map((item) => {
                    const status = syncStatus[item.id];
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          <item.icon className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{item.label}</p>
                            {status && (
                              <p className="text-xs text-muted-foreground">
                                {status.message}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={status?.success ? "outline" : "default"}
                          onClick={() => handleSync(item.id as "contacts" | "deals" | "activities")}
                          disabled={isSyncing || connectionStatus !== "success"}
                        >
                          {isSyncing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : status?.success ? (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              Synchro
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4 mr-1" />
                              Sync
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}

                <Separator className="my-4" />

                <Button
                  className="w-full"
                  onClick={handleSyncAll}
                  disabled={isSyncing || connectionStatus !== "success" || selectedTypes.length === 0}
                >
                  {isSyncing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Synchroniser tout
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>

                {connectionStatus !== "success" && (
                  <p className="text-xs text-center text-muted-foreground">
                    Testez d'abord la connexion pour activer la synchronisation
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
