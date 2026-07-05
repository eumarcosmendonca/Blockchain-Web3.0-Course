/**
 * Servidor estático mínimo para o dApp (sem dependências externas).
 * Serve a pasta frontend/ em http://localhost:8080.
 *
 * Rode com:  npm run frontend
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.FRONTEND_PORT || 8080;
const RAIZ = __dirname;

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
};

const servidor = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";

  // impede path traversal
  const arquivo = path.join(RAIZ, path.normalize(urlPath));
  if (!arquivo.startsWith(RAIZ)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(arquivo, (err, dados) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Arquivo não encontrado: " + urlPath);
      return;
    }
    const ext = path.extname(arquivo);
    res.writeHead(200, { "Content-Type": TIPOS[ext] || "application/octet-stream" });
    res.end(dados);
  });
});

servidor.listen(PORT, () => {
  console.log(`dApp CareChain em http://localhost:${PORT}`);
  console.log("Abra no navegador com a extensão MetaMask instalada.");
});
