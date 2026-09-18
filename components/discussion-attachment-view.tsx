import { DiscussionAttachment } from "@/type";

export function DiscussionAttachmentView({
  attachment,
}: {
  attachment: DiscussionAttachment;
}) {
  if (attachment.type === "sticker") {
    return <span className="text-5xl leading-none">{attachment.emoji}</span>;
  }

  return (
    <a href={attachment.url} target="_blank" rel="noopener noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={attachment.url}
        alt={attachment.name || "Gambar"}
        className="mt-2 max-h-64 max-w-full rounded-md border object-contain"
      />
    </a>
  );
}
