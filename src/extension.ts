import * as vscode from "vscode";
import * as path from "path";

export function activate(context: vscode.ExtensionContext) {
  const provider = new MyWebviewViewProvider(context);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider("problemsoftware", provider));

  function updateProblems() {
    const allDiagnostics = vscode.languages.getDiagnostics();
    const totalProblems = allDiagnostics.reduce((acc, [_, diagnostics]) => acc + diagnostics.length, 0);
    provider.updateProblemCount(totalProblems);
  }
  context.subscriptions.push(vscode.languages.onDidChangeDiagnostics(updateProblems));

  // * settings manually changed
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("problemsoftware.maxProblemCount")) updateProblems();
    })
  );
  // * settings changed via command
  context.subscriptions.push(
    vscode.commands.registerCommand("problemsoftware.setMaxProblemCount", async () => {
      const config = vscode.workspace.getConfiguration("problemsoftware");
      const current = config.get<number>("maxProblemCount", 50);

      const input = await vscode.window.showInputBox({
        prompt: "Enter the maximum number of problems before PirateSoftware eats your soul",
        value: current.toString(),
        validateInput: (value) => {
          const num = Number(value);
          return isNaN(num) || num < 1 ? "Please enter a valid number >= 1" : null;
        }
      });

      if (input === undefined) return;

      const newValue = Number(input);
      await config.update("maxProblemCount", newValue, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`ProblemSoftware maximum problem count set to ${newValue}`);
    })
  );

  updateProblems();
}

class MyWebviewViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  constructor(private context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView;
    const webview = webviewView.webview;

    webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(path.join(this.context.extensionPath, "src", "assets"))]
    };

    const imagePathOnDisk = vscode.Uri.file(path.join(this.context.extensionPath, "src", "assets", "piratesoftware.png"));
    const imageSrc = webview.asWebviewUri(imagePathOnDisk);

    webview.html = this.getHtml(imageSrc.toString());
  }

  public updateProblemCount(count: number) {
    const config = vscode.workspace.getConfiguration("problemsoftware");
    const maxCount = config.get<number>("maxProblemCount", 50);

    this.view?.webview.postMessage({
      type: "updateProblems",
      count,
      maxCount
    });
  }

  private getHtml(imageSrc: string): string {
    return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
      <body style="overflow: hidden">
        <div>
          <img id="problem-image" src="${imageSrc}" width="210px" style="transition: opacity 0.3s; opacity: 0.05;" />
          <p id="encouragement" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; z-index: -1;">0 problems! Good job!</p>
        </div>

        <script>
          function getProblemText(count, maxCount) {
            if (count === 0) return "0 problems! Good job!";
            if (count <= maxCount / 10) return count + " problems, all good gang"; // ? default: 5
            if (count <= maxCount / 5) return "You gonna fix those " + count + " problems?"; // ? default: 10
            if (count <= maxCount / 2) return "Fix these " + count + " problems NOW!"; // ? default: 25
            if (count <= maxCount / 1.25) return count + " problems is NOT a flex lil bro"; // ? default: 40
            return count + " problems... lock your doors";
          }

          window.addEventListener('message', (event) => {
            const message = event.data;
            if (message.type !== 'updateProblems') return;

            const count = message.count;
            const maxProblems = message.maxCount;
            const opacity = Math.max(0.05, Math.min(1, count / maxProblems));

            document.getElementById('problem-image').style.opacity = opacity;
            document.getElementById("encouragement").innerText = getProblemText(count, maxProblems);
          });
        </script>
      </body>
      </html>
    `;
  }
}
