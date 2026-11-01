import subprocess
import logging
from typing import Dict, Any
from config import REPO_DIR, REMOTE_NAME, BRANCH_NAME

logger = logging.getLogger(__name__)

def run_git_cmd(*args: str) -> subprocess.CompletedProcess:
    """Executes a git command in the repository directory."""
    return subprocess.run(
        ["git", *args],
        cwd=REPO_DIR,
        capture_output=True,
        text=True,
        check=False
    )

def connect_and_sync_repo() -> Dict[str, Any]:
    """
    Connects with the remote git repository and synchronizes state.
    Called before initiating conversations with Ramneek.
    """
    result: Dict[str, Any] = {
        "success": False,
        "remote_url": None,
        "branch": BRANCH_NAME,
        "commit_hash": None,
        "commit_message": None,
        "status_detail": "",
        "action_taken": "none"
    }

    try:
        # 1. Get remote URL
        remote_proc = run_git_cmd("remote", "get-url", REMOTE_NAME)
        if remote_proc.returncode != 0:
            result["status_detail"] = f"Remote '{REMOTE_NAME}' not found."
            return result
        result["remote_url"] = remote_proc.stdout.strip()

        # 2. Connect / Fetch latest changes from remote
        logger.info(f"Connecting to remote repository: {result['remote_url']}...")
        fetch_proc = run_git_cmd("fetch", REMOTE_NAME, BRANCH_NAME)
        if fetch_proc.returncode != 0:
            result["status_detail"] = f"Fetch failed: {fetch_proc.stderr.strip()}"
            # Still retrieve local info even if fetch had a network hiccup
            rev_proc = run_git_cmd("rev-parse", "--short", "HEAD")
            if rev_proc.returncode == 0:
                result["commit_hash"] = rev_proc.stdout.strip()
            return result

        # 3. Check difference between HEAD and remote
        local_ref = "HEAD"
        remote_ref = f"{REMOTE_NAME}/{BRANCH_NAME}"
        
        # Check commits behind/ahead
        rev_list_proc = run_git_cmd("rev-list", "--left-right", "--count", f"{local_ref}...{remote_ref}")
        if rev_list_proc.returncode == 0:
            counts = rev_list_proc.stdout.strip().split()
            ahead = int(counts[0]) if len(counts) > 0 else 0
            behind = int(counts[1]) if len(counts) > 1 else 0

            if behind > 0:
                # Fast-forward pull
                pull_proc = run_git_cmd("pull", "--ff-only", REMOTE_NAME, BRANCH_NAME)
                if pull_proc.returncode == 0:
                    result["action_taken"] = f"Pulled {behind} new commit(s)"
                else:
                    result["action_taken"] = f"Pull warning: {pull_proc.stderr.strip()}"
            elif ahead > 0:
                result["action_taken"] = f"Local is {ahead} commit(s) ahead"
            else:
                result["action_taken"] = "Up to date"

        # 4. Get current commit details
        commit_proc = run_git_cmd("log", "-1", "--format=%h - %s (%cr)")
        if commit_proc.returncode == 0:
            result["commit_message"] = commit_proc.stdout.strip()

        rev_proc = run_git_cmd("rev-parse", "--short", "HEAD")
        if rev_proc.returncode == 0:
            result["commit_hash"] = rev_proc.stdout.strip()

        result["success"] = True
        result["status_detail"] = f"Connected ({result['action_taken']})"
        logger.info(f"Repo successfully synced: {result['commit_hash']} - {result['status_detail']}")

    except Exception as e:
        logger.error(f"Error while connecting to repo: {e}", exc_info=True)
        result["status_detail"] = str(e)

    return result

def get_repo_summary() -> str:
    """Returns a short human-readable summary of repository connection status."""
    info = connect_and_sync_repo()
    if info["success"]:
        return (
            f"🔗 **Repository Connected**\n"
            f"• Remote: `{info['remote_url']}`\n"
            f"• Branch: `{info['branch']}`\n"
            f"• Latest Commit: `{info['commit_hash']}` ({info['commit_message']})\n"
            f"• Sync Status: {info['action_taken']}"
        )
    return f"⚠️ **Repository Connection Issue**: {info['status_detail']}"
