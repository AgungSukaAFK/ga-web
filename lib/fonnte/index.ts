// utils/fonnteApi.ts

export enum MessageType {
  TEXT = "text",
  BUTTON = "button",
  TEMPLATE = "template",
  LIST = "list",
}

interface BaseMessageOptions {
  target: string; // Nomor tujuan (contoh: "6282227097005")
  message?: string;
  url?: string;
  filename?: string;
  schedule?: string;
  delay?: string;
  countryCode?: string;
  token: string; // API Token Fonnte
}

interface ButtonTemplate {
  message: string;
  footer?: string;
  buttons: { id?: string; message: string }[];
}

interface LinkTemplate {
  message: string;
  footer?: string;
  buttons: { id?: string; message: string; url?: string; tel?: string }[];
}

interface ListTemplate {
  message: string;
  footer?: string;
  buttonTitle: string;
  title: string;
  buttons: {
    title: string;
    list: { id: string; message: string; footer?: string }[];
  }[];
}

type MessagePayload =
  | { type: MessageType.TEXT; message: string }
  | { type: MessageType.BUTTON; buttonJSON: ButtonTemplate }
  | { type: MessageType.TEMPLATE; templateJSON: LinkTemplate }
  | { type: MessageType.LIST; listJSON: ListTemplate };

export async function sendFonnteMessage(
  baseOptions: BaseMessageOptions,
  payload: MessagePayload
): Promise<any> {
  const form = new FormData();

  form.append("target", baseOptions.target);
  if (baseOptions.message) form.append("message", baseOptions.message);
  if (baseOptions.url) form.append("url", baseOptions.url);
  if (baseOptions.filename) form.append("filename", baseOptions.filename);
  form.append("schedule", baseOptions.schedule ?? "0");
  form.append("delay", baseOptions.delay ?? "2");
  form.append("countryCode", baseOptions.countryCode ?? "62");

  // Tambahkan template sesuai tipe
  switch (payload.type) {
    case MessageType.TEXT:
      form.append("message", payload.message);
      break;
    case MessageType.BUTTON:
      form.append("buttonJSON", JSON.stringify(payload.buttonJSON));
      break;
    case MessageType.TEMPLATE:
      form.append("templateJSON", JSON.stringify(payload.templateJSON));
      break;
    case MessageType.LIST:
      form.append("listJSON", JSON.stringify(payload.listJSON));
      break;
  }

  const response = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    mode: "cors",
    headers: {
      Authorization: process.env.NEXT_PUBLIC_FONNTE_TOKEN || "",
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`HTTP Error ${response.status}`);
  }

  return await response.json();
}
