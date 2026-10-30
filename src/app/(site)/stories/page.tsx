import { listMetadata, PostListPage } from "@/components/site/PostListPage";

export const generateMetadata = () => listMetadata("story");

export default function Page() {
  return <PostListPage section="story" />;
}
