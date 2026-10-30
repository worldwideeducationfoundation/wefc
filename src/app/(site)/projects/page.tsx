import { listMetadata, PostListPage } from "@/components/site/PostListPage";

export const generateMetadata = () => listMetadata("project");

export default function Page() {
  return <PostListPage section="project" />;
}
