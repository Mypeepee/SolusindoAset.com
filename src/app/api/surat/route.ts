import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File;
    const type = form.get("type");

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    const prompt =
      type === "ktp"
        ? `
Extract Indonesian KTP information.

Return JSON only:

{
 "nama": "",
 "nik": "",
 "alamat": ""
}
`
        : `
Extract Indonesian auction risalah information.

Return JSON only:

{
 "nomor_risalah": "",
 "tanggal_risalah": "",
 "bank": ""
}
`;

    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            {
              type: "input_image",
              image_base64: base64,
            },
          ],
        },
      ],
    });

    const text = response.output_text;

    let json;

    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    return NextResponse.json(json);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Parser failed" },
      { status: 500 }
    );
  }
}