import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WorkbookData {
  attorneyEmail: string;
  ownerEmail: string;
  formData: Record<string, string | boolean>;
  htmlContent: string;
  timestamp: string;
}

function generateEmailHTML(formData: Record<string, string | boolean>): string {
  const sections = [
    {
      title: "Meeting Objectives",
      fields: ["meeting_date", "current_trial", "target_continuance", "min_continuance", "continuance_justification", "intel_goals", "walk_away"]
    },
    {
      title: "Groff Impeachment Strategy",
      fields: ["groff_point_1", "groff_point_2", "groff_point_3", "groff_point_4", "groff_point_5", "groff_point_6", "groff_vulnerabilities", "groff_questions"]
    },
    {
      title: "Discovery Pressure",
      fields: ["demand_302s", "demand_brady", "demand_giglio", "demand_notes", "demand_groff_proffer", "demand_groff_deal", "demand_warrant", "demand_communications", "specific_discovery", "discovery_timeline"]
    },
    {
      title: "Government Scenarios & Responses",
      fields: ["resp_1", "resp_2", "resp_3", "resp_4", "resp_5", "resp_6", "resp_7", "resp_8", "resp_9", "resp_10", "other_scenarios"]
    },
    {
      title: "Intel & Authorization",
      fields: ["intel_trial", "intel_groff", "intel_discovery", "intel_negotiate", "location", "time", "ausa", "client_present", "client_sig", "sig_date"]
    }
  ];

  const formatFieldName = (name: string): string => {
    return name
      .replace(/_/g, " ")
      .replace(/\b\w/g, l => l.toUpperCase())
      .replace(/Resp (\d+)/, "Response #$1");
  };

  const formatValue = (value: string | boolean): string => {
    if (typeof value === "boolean") return value ? "✓ Yes" : "✗ No";
    if (!value || value === "") return "<em style='color:#999'>Not provided</em>";
    return value.replace(/\n/g, "<br>");
  };

  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #1a1a1a; }
    .header { background: linear-gradient(135deg, #003366 0%, #1a4d80 100%); color: white; padding: 25px; border-radius: 12px; margin-bottom: 20px; }
    .confidential { background: #cc0000; padding: 4px 12px; font-size: 10px; font-weight: bold; letter-spacing: 1px; display: inline-block; border-radius: 3px; margin-bottom: 10px; }
    .header h1 { font-size: 20px; margin: 0; }
    .header p { font-size: 12px; opacity: 0.9; margin-top: 5px; }
    .section { background: #f8f9fa; border-radius: 10px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #003366; }
    .section h2 { color: #003366; font-size: 16px; margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #e0e0e0; }
    .field { margin-bottom: 12px; }
    .field-label { font-weight: 600; color: #003366; font-size: 13px; }
    .field-value { background: white; padding: 10px; border-radius: 6px; margin-top: 4px; font-size: 14px; border: 1px solid #e0e0e0; }
    .checkbox-item { display: inline-block; margin-right: 15px; font-size: 13px; }
    .footer { text-align: center; font-size: 11px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <span class="confidential">PRIVILEGED & CONFIDENTIAL — ATTORNEY WORK PRODUCT</span>
    <h1>Attorney Workbook — Pre-Meeting Preparation</h1>
    <p>US v. Redmond | EDPA 24-376 | Generated: ${new Date().toLocaleString()}</p>
  </div>
`;

  for (const section of sections) {
    html += `<div class="section"><h2>${section.title}</h2>`;

    const checkboxFields: string[] = [];
    const textFields: string[] = [];

    for (const field of section.fields) {
      const value = formData[field];
      if (typeof value === "boolean") {
        checkboxFields.push(field);
      } else {
        textFields.push(field);
      }
    }

    // Render checkboxes inline
    if (checkboxFields.length > 0) {
      html += `<div class="field"><div class="field-label">Checklist Items</div><div class="field-value">`;
      for (const field of checkboxFields) {
        const checked = formData[field] === true;
        html += `<span class="checkbox-item">${checked ? "✓" : "☐"} ${formatFieldName(field)}</span>`;
      }
      html += `</div></div>`;
    }

    // Render text fields
    for (const field of textFields) {
      const value = formData[field];
      if (value !== undefined) {
        html += `
          <div class="field">
            <div class="field-label">${formatFieldName(field)}</div>
            <div class="field-value">${formatValue(value)}</div>
          </div>`;
      }
    }

    html += `</div>`;
  }

  html += `
  <div class="footer">
    <p><strong>⚠️ ATTORNEY WORK PRODUCT — DO NOT DISTRIBUTE</strong></p>
    <p>This document was generated from the secure Attorney Workbook portal.</p>
    <p>Print this page to PDF for your records (Cmd/Ctrl + P → Save as PDF)</p>
  </div>
</body>
</html>`;

  return html;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SENDGRID_API_KEY) {
      throw new Error("SENDGRID_API_KEY not configured");
    }

    const { attorneyEmail, ownerEmail, formData, timestamp }: WorkbookData = await req.json();

    if (!attorneyEmail || !ownerEmail) {
      throw new Error("Missing email addresses");
    }

    // Generate the HTML email content
    const htmlContent = generateEmailHTML(formData);

    // Send email via SendGrid
    const emailResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [
              { email: attorneyEmail },
              { email: ownerEmail }
            ],
            subject: `Attorney Workbook - Pre-Meeting Prep (${new Date(timestamp).toLocaleDateString()})`
          }
        ],
        from: {
          email: "alanredmond23@gmail.com",
          name: "Attorney Workbook"
        },
        content: [
          {
            type: "text/html",
            value: htmlContent
          }
        ],
        attachments: [
          {
            content: btoa(htmlContent),
            filename: `Attorney_Workbook_${new Date(timestamp).toISOString().split("T")[0]}.html`,
            type: "text/html",
            disposition: "attachment"
          }
        ]
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      throw new Error(`SendGrid API error: ${errorText}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
