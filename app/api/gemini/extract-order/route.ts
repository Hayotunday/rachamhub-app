import { GoogleGenerativeAI } from "@google/generative-ai";
import { ExtractedOrder, GeminiResponse } from "@/lib/types";

const EXTRACTION_PROMPT = `
You are an order extraction AI for RachamHub, a Lagos-based logistics company.
Extract order details from the provided text and return a valid JSON object.

IMPORTANT: Always return valid JSON that matches this exact structure:
{
  "customerName": "string (customer name)",
  "deliveryAddress": "string or null (delivery address)",
  "phoneNumbers": ["string (phone number)"],
  "merchant": "string or null (merchant name)",
  "comment": "string or null (customer comment or internal note)",
  "items": [
    {
      "name": "string (item name)",
      "quantity": number (quantity as a number),
    }
  ],
  "totalAmount": number (total amount as a number, use 0 if not specified),
}

Rules:
1. Extract customer name, delivery address, phone numbers, merchant, and comment from the text if available
2. List all items with their quantities
3. Calculate or extract total amount
4. Return ONLY valid JSON, no markdown, no extra text
5. If a field is not provided, use null for optional fields
6. Ensure quantities are numbers, not strings
7. If no total amount is provided, use 0
8. Ensure the JSON is properly formatted and valid
9. Ensure the quantity and total amount are not multiplied under any circumstances.
   If the text mentions "2 items of 3", the quantity should be 2, not 6.

Text to extract from:
`;

export async function POST(request: Request) {
  try {
    // Parse request body
    const { text, apiKeyId } = await request.json();

    // Select the appropriate API key
    let selectedApiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (apiKeyId && apiKeyId !== "DEFAULT") {
      selectedApiKey = process.env[`GOOGLE_GEMINI_API_KEY_${apiKeyId}`];
    }

    // Validate API key
    if (!selectedApiKey) {
      console.error(
        `[Gemini API] Missing API key for selection: ${apiKeyId || "DEFAULT"}`,
      );
      return Response.json(
        {
          success: false,
          error: "Selected Gemini API key is not configured.",
        },
        { status: 500 },
      );
    }

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return Response.json(
        {
          success: false,
          error: "Please provide order text to extract",
        },
        { status: 400 },
      );
    }

    // Initialize Gemini API client
    const gemini = new GoogleGenerativeAI(selectedApiKey);

    // Call Gemini API
    const model = gemini.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = EXTRACTION_PROMPT + "\n" + text;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse JSON response
    let extractedData: ExtractedOrder;
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      extractedData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("[Gemini API] JSON parse error:", parseError);
      return Response.json(
        {
          success: false,
          error:
            "Failed to parse extracted order data. Please try again with clearer information.",
        },
        { status: 400 },
      );
    }

    // Validate extracted data structure
    if (!extractedData.customerName || !Array.isArray(extractedData.items)) {
      return Response.json(
        {
          success: false,
          error:
            "Could not extract required order information. Please provide customer name and at least one item.",
        },
        { status: 400 },
      );
    }

    const response: GeminiResponse = {
      success: true,
      data: extractedData,
    };

    return Response.json(response);
  } catch (error) {
    console.error("[Gemini API] Error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to extract order";
    return Response.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
