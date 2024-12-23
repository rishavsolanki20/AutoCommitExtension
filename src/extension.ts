import * as vscode from 'vscode';
import git from 'simple-git'; // Import simple-git for Git commands

let timer: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
  // Get the repository path
  const repoPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  if (!repoPath) {
    vscode.window.showErrorMessage('No repository found in the workspace.');
    return;
  }

  const gitRepo = git(repoPath);
  const globalState = context.globalState;

  // Prompt user for the task they are working on
  vscode.window.showInputBox({ prompt: 'What task are you working on?' }).then(taskDescription => {
    if (taskDescription) {
      globalState.update('currentTask', taskDescription);
      globalState.update('taskCounter', ((globalState.get('taskCounter') as number) || 0) + 1);
    }
  });

  // Start a timer that runs every 30 minutes for auto-commit
  timer = setInterval(async () => {
    try {
      const status = await gitRepo.status();
      if (status.isClean()) {
        vscode.window.showInformationMessage('No changes to commit.');
        return;
      }

      // Get the task description and task counter from global state
      const taskDescription = globalState.get<string>('currentTask') || 'Unspecified task';
      const taskCounter = globalState.get<number>('taskCounter') || 1;

      // Generate a commit message
      const commitMessage = await buildTaskCommitMessage(taskCounter, taskDescription, gitRepo);

      // Stage and commit the changes
      await gitRepo.add('./*');
      await gitRepo.commit(commitMessage);

      vscode.window.showInformationMessage(`Changes committed automatically: ${commitMessage}`);
    } catch (err) {
      console.error('Error during auto-commit:', err);
      vscode.window.showErrorMessage('Failed to auto-commit changes.');
    }
  },  60 * 1000); // 30 minutes in milliseconds

  // Cleanup on extension deactivation
  context.subscriptions.push({
    dispose: () => {
      if (timer) {
        clearInterval(timer);
      }
    },
  });
}

// Helper function to build the commit message
async function buildTaskCommitMessage(taskCounter: number, taskDescription: string, gitRepo: any): Promise<string> {
  const status = await gitRepo.status();
  const filesChanged = status.modified.concat(status.created, status.deleted).join(', ');
  return `task_${taskCounter}: ${taskDescription}\nChanged files: ${filesChanged}`;
}

export function deactivate() {
  if (timer) {
    clearInterval(timer);
  }
}
