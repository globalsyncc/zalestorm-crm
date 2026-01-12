import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ApiConfig {
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Non autorisé - authentification requise" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { action, config, dataType } = await req.json();

    // Get API credentials from secrets
    const COMPANY_API_URL = Deno.env.get("COMPANY_API_URL");
    const COMPANY_API_KEY = Deno.env.get("COMPANY_API_KEY");

    console.log(`Company API Sync - Action: ${action}, DataType: ${dataType}`);

    switch (action) {
      case "test_connection": {
        if (!config?.baseUrl) {
          return new Response(
            JSON.stringify({ success: false, error: "URL de l'API requise" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        try {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };

          if (config.authType === "bearer" && config.apiKey) {
            headers["Authorization"] = `Bearer ${config.apiKey}`;
          } else if (config.authType === "api-key" && config.apiKey) {
            headers["X-API-Key"] = config.apiKey;
          }

          const response = await fetch(config.baseUrl, {
            method: "GET",
            headers,
          });

          return new Response(
            JSON.stringify({ 
              success: response.ok, 
              status: response.status,
              message: response.ok ? "Connexion réussie" : "Échec de la connexion"
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch (error) {
          console.error("Connection test error:", error);
          return new Response(
            JSON.stringify({ success: false, error: "Impossible de contacter l'API" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      case "sync_data": {
        const baseUrl = config?.baseUrl || COMPANY_API_URL;
        const apiKey = config?.apiKey || COMPANY_API_KEY;

        if (!baseUrl) {
          return new Response(
            JSON.stringify({ error: "Configuration API manquante" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (config?.authType === "bearer" && apiKey) {
          headers["Authorization"] = `Bearer ${apiKey}`;
        } else if (config?.authType === "api-key" && apiKey) {
          headers["X-API-Key"] = apiKey;
        }

        const endpoint = config?.endpoints?.[dataType] || `/${dataType}`;
        const fullUrl = `${baseUrl}${endpoint}`;

        console.log(`Fetching data from: ${fullUrl}`);

        try {
          const response = await fetch(fullUrl, { method: "GET", headers });
          
          if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
          }

          const externalData = await response.json();
          console.log(`Received ${Array.isArray(externalData) ? externalData.length : 1} ${dataType} records`);

          // Map and sync data based on type
          let syncedCount = 0;
          let errors: string[] = [];

          if (dataType === "contacts" && Array.isArray(externalData)) {
            for (const contact of externalData) {
              try {
                const mappedContact = {
                  first_name: contact.firstName || contact.first_name || contact.prenom || "",
                  last_name: contact.lastName || contact.last_name || contact.nom || "",
                  email: contact.email || "",
                  phone: contact.phone || contact.telephone || "",
                  company_id: contact.companyId || contact.company_id || null,
                  position: contact.position || contact.poste || "",
                  external_id: String(contact.id || contact.externalId || ""),
                };

                // Upsert based on external_id or email
                const { error } = await supabase
                  .from("contacts")
                  .upsert(mappedContact, { 
                    onConflict: "email",
                    ignoreDuplicates: false 
                  });

                if (error) {
                  console.error("Contact sync error:", error);
                  errors.push(`Contact ${contact.email}: ${error.message}`);
                } else {
                  syncedCount++;
                }
              } catch (e) {
                errors.push(`Contact mapping error: ${e}`);
              }
            }
          }

          if (dataType === "deals" && Array.isArray(externalData)) {
            for (const deal of externalData) {
              try {
                const mappedDeal = {
                  title: deal.title || deal.name || deal.titre || "",
                  value: parseFloat(deal.value || deal.amount || deal.montant || 0),
                  stage: deal.stage || deal.status || "lead",
                  contact_id: deal.contactId || deal.contact_id || null,
                  company_id: deal.companyId || deal.company_id || null,
                  probability: parseInt(deal.probability || deal.probabilite || 50),
                  expected_close_date: deal.expectedCloseDate || deal.expected_close_date || null,
                  external_id: String(deal.id || deal.externalId || ""),
                };

                const { error } = await supabase
                  .from("deals")
                  .upsert(mappedDeal, { ignoreDuplicates: false });

                if (error) {
                  errors.push(`Deal ${deal.title}: ${error.message}`);
                } else {
                  syncedCount++;
                }
              } catch (e) {
                errors.push(`Deal mapping error: ${e}`);
              }
            }
          }

          if (dataType === "activities" && Array.isArray(externalData)) {
            for (const activity of externalData) {
              try {
                const mappedActivity = {
                  type: activity.type || "note",
                  description: activity.description || activity.content || "",
                  contact_id: activity.contactId || activity.contact_id || null,
                  deal_id: activity.dealId || activity.deal_id || null,
                  due_date: activity.dueDate || activity.due_date || null,
                  completed: activity.completed || false,
                };

                const { error } = await supabase
                  .from("activities")
                  .insert(mappedActivity);

                if (error) {
                  errors.push(`Activity: ${error.message}`);
                } else {
                  syncedCount++;
                }
              } catch (e) {
                errors.push(`Activity mapping error: ${e}`);
              }
            }
          }

          return new Response(
            JSON.stringify({ 
              success: true, 
              synced: syncedCount,
              total: Array.isArray(externalData) ? externalData.length : 1,
              errors: errors.length > 0 ? errors : undefined
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );

        } catch (error) {
          console.error("Sync error:", error);
          return new Response(
            JSON.stringify({ error: `Erreur de synchronisation: ${error}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      case "get_config": {
        // Return stored API configuration (without sensitive data)
        return new Response(
          JSON.stringify({
            configured: !!COMPANY_API_URL,
            baseUrl: COMPANY_API_URL ? "***configured***" : null,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Action non reconnue" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Company API Sync error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
