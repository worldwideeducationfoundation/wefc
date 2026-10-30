import { ArticlePage, articleMetadata } from "@/components/site/ArticlePage";

type Props = { params: Promise<{ slug: string }> };

export const generateMetadata = ({ params }: Props) => articleMetadata("project", params);

export default function Page({ params }: Props) {
  return <ArticlePage section="project" params={params} />;
}
