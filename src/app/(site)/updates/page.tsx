import { listMetadata, PostListPage } from "@/components/site/PostListPage";

export const generateMetadata = () => listMetadata("update");

export default function Page() {
  return <PostListPage section="update" />;
}
