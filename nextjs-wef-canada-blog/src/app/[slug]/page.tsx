import { PortableText, type SanityDocument } from "next-sanity";
import { createImageUrlBuilder, type SanityImageSource } from "@sanity/image-url";
import { client } from "@/sanity/client";
import Link from "next/link";

const POST_QUERY = `*[_type == "post" && slug.current == $slug][0]`;

const { projectId, dataset } = client.config();
const urlFor = (source: SanityImageSource) =>
  projectId && dataset
    ? createImageUrlBuilder({ projectId, dataset }).image(source)
    : null;

const options = { next: { revalidate: 30 } };

interface PostPageProps {
  params: Promise<{ slug: string }>;
}

export default async function PostPage({ params }: PostPageProps) {
  const resolvedParams = await params;
  const post = await client.fetch<SanityDocument>(POST_QUERY, resolvedParams, options);
  
  if (!post) {
    return (
      <main className="container mx-auto min-h-screen max-w-3xl p-8 flex flex-col gap-4 text-center">
        <h1 className="text-2xl font-bold">Article not found</h1>
        <Link href="/" className="text-blue-500 hover:underline">
          ← Back to posts
        </Link>
      </main>
    );
  }

  const postImageUrl = post.mainImage
    ? urlFor(post.mainImage)?.width(550).height(310).url()
    : null;

  return (
    <main className="container mx-auto min-h-screen max-w-3xl p-8 flex flex-col gap-4">
      <Link href="/" className="hover:underline">
        ← Back to posts
      </Link>
      {postImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={postImageUrl}
          alt={post.title}
          className="aspect-video rounded-xl object-cover"
          width="550"
          height="310"
        />
      )}
      <h1 className="text-4xl font-bold mb-8">{post.title}</h1>
      <div className="prose">
        <p className="text-gray-500 mb-4">
          Published: {new Date(post.publishedAt).toLocaleDateString()}
        </p>
        {Array.isArray(post.body) && <PortableText value={post.body} />}
      </div>
    </main>
  );
}
