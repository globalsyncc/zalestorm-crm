import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication - JWT verification is now enforced at config level
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Non autorisé - authentification requise" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, messages, contactId, dealId, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Create supabase client for data access with authenticated user's token
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader ?? "" } } }
    );

    let systemPrompt = "";
    let userPrompt = "";

    switch (action) {
      case "chat":
        // Fetch CRM context for the assistant
        const { data: contacts } = await supabase.from("contacts").select("*").limit(50);
        const { data: deals } = await supabase.from("deals").select("*").limit(50);
        const { data: activities } = await supabase.from("activities").select("*").limit(20);

        systemPrompt = `Tu es un assistant IA expert en CRM et gestion de la relation client pour Zalestorm.
Tu as accès aux données suivantes du CRM:
- ${contacts?.length || 0} contacts
- ${deals?.length || 0} opportunités/deals
- ${activities?.length || 0} activités récentes

Données contacts: ${JSON.stringify(contacts?.slice(0, 10) || [])}
Données deals: ${JSON.stringify(deals?.slice(0, 10) || [])}
Données activités: ${JSON.stringify(activities?.slice(0, 5) || [])}

Tu peux répondre en français aux questions sur les contacts, deals, pipeline, et donner des conseils commerciaux.
Sois concis, professionnel et proactif dans tes recommandations.`;
        break;

      case "lead_scoring":
        systemPrompt = `Tu es un expert en lead scoring. Analyse les données du contact/deal fourni et attribue un score de 0 à 100.
Réponds UNIQUEMENT avec un JSON: {"score": number, "reasons": string[], "recommendations": string[]}`;
        userPrompt = `Analyse ce lead et attribue un score: ${JSON.stringify(context)}`;
        break;

      case "suggest_actions":
        systemPrompt = `Tu es un conseiller commercial expert. Basé sur le contexte du deal/contact, suggère les 3 prochaines actions prioritaires.
Réponds UNIQUEMENT avec un JSON: {"actions": [{"title": string, "description": string, "priority": "high"|"medium"|"low", "type": "call"|"email"|"meeting"|"task"}]}`;
        userPrompt = `Suggère les prochaines actions pour: ${JSON.stringify(context)}`;
        break;

      case "draft_email":
        systemPrompt = `Tu es un expert en rédaction commerciale. Rédige un email professionnel et personnalisé.
Réponds UNIQUEMENT avec un JSON: {"subject": string, "body": string}`;
        userPrompt = `Rédige un email pour: ${JSON.stringify(context)}`;
        break;

      case "summarize":
        systemPrompt = `Tu es un assistant qui résume les informations CRM de manière concise et actionnable.`;
        userPrompt = `Résume ces informations: ${JSON.stringify(context)}`;
        break;

      default:
        throw new Error("Action non reconnue");
    }

    // For chat, we stream; for other actions, we don't
    const shouldStream = action === "chat";
    
    const aiMessages = action === "chat" 
      ? [{ role: "system", content: systemPrompt }, ...messages]
      : [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        stream: shouldStream,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte, réessayez plus tard." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA épuisés, veuillez recharger." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Erreur du service IA");
    }

    if (shouldStream) {
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    } else {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      
      // Try to parse JSON response for structured actions
      try {
        const parsed = JSON.parse(content);
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        return new Response(JSON.stringify({ result: content }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
  } catch (error) {
    console.error("CRM AI error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
