import re
from github import Github
from core.config import settings
from core.database import AsyncSessionLocal
from core.models import ChatMessage


class GitHubPRManager:
    def __init__(self):
        self.gh = Github(settings.GITHUB_TOKEN) if settings.GITHUB_TOKEN else None
        self.repo_name = "greedylm/greedylm"  # Placeholder

    def _get_repo(self):
        if not self.gh:
            return None
        return self.gh.get_repo(self.repo_name)

    async def get_pending_prs(self) -> list:
        repo = self._get_repo()
        if not repo:
            return []

        prs = repo.get_pulls(state="open")
        pending = []
        for pr in prs:
            if pr.head.ref.startswith("agents/proposed/"):
                # Extract DID from body using regex
                did_match = re.search(r"DID: (did:v8:[a-f0-9]+)", pr.body or "")
                did = did_match.group(1) if did_match else "unknown"

                pending.append(
                    {
                        "pr_number": pr.number,
                        "title": pr.title,
                        "author_did": did,
                        "files_changed": pr.changed_files,
                        "diff_url": pr.diff_url,
                        "created_at": pr.created_at,
                        "is_ci_passing": True,  # Placeholder for actual status check
                    }
                )
        return pending

    async def get_pr_diff(self, pr_number: int) -> str:
        repo = self._get_repo()
        if not repo:
            return ""
        pr = repo.get_pull(pr_number)
        # PyGithub doesn't have a direct "get diff string", we use the URL or patches
        return f"View diff at: {pr.diff_url}"

    async def approve_pr(self, pr_number: int, admin_note: str):
        repo = self._get_repo()
        if not repo:
            return
        pr = repo.get_pull(pr_number)

        # Merge
        pr.merge(merge_method="squash", commit_message=f"Admin Approval: {admin_note}")

        # Notify agent (simulate chat message)
        did_match = re.search(r"DID: (did:v8:[a-f0-9]+)", pr.body or "")
        if did_match:
            did = did_match.group(1)
            async with AsyncSessionLocal() as db:
                msg = ChatMessage(
                    sender_did="admin",
                    receiver_did=did,
                    content=f"Your proposal '{pr.title}' was approved. Note: {admin_note}",
                )
                db.add(msg)
                await db.commit()

    async def reject_pr(self, pr_number: int, reason: str):
        repo = self._get_repo()
        if not repo:
            return
        pr = repo.get_pull(pr_number)
        pr.create_issue_comment(f"Rejected: {reason}")
        pr.edit(state="closed")


github_pr_manager = GitHubPRManager()
