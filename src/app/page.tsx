import { DocumentCard } from "@/components/document-card";
import { getRecentDocuments } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const docs = await getRecentDocuments(30);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
      <h1 className="mb-1 text-lg font-semibold tracking-tight">Latest</h1>
      <p className="mb-4 text-sm text-zinc-500">
        Recent AI/ML research and discussion, deduplicated across arXiv and Hacker News.
      </p>

      {docs.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-500">No documents yet.</p>
      ) : (
        <div>
          {docs.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} />
          ))}
        </div>
      )}
    </main>
  );
}
