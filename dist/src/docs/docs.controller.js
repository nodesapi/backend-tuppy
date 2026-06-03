"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocsController = void 0;
const common_1 = require("@nestjs/common");
let DocsController = class DocsController {
    renderLoginHtml(errorMsg = '') {
        return `
      <!DOCTYPE html>
      <html lang="id">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Tupply API - Secure Access</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
              body {
                  background-color: #09090b;
                  color: #fafafa;
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              }
              .glass-panel {
                  background: rgba(24, 24, 27, 0.7);
                  backdrop-filter: blur(16px);
                  -webkit-backdrop-filter: blur(16px);
                  border: 1px solid rgba(255, 255, 255, 0.1);
              }
          </style>
      </head>
      <body class="min-h-screen flex items-center justify-center p-4">
          
          <!-- Background effect -->
          <div class="fixed inset-0 overflow-hidden pointer-events-none">
              <div class="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-600/20 blur-[120px]"></div>
              <div class="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-purple-600/20 blur-[120px]"></div>
          </div>

          <div class="glass-panel w-full max-w-md p-8 rounded-2xl shadow-2xl relative z-10 animate-[pulse_0.5s_ease-out]">
              <div class="text-center mb-8">
                  <div class="w-16 h-16 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg">
                      <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                      </svg>
                  </div>
                  <h1 class="text-2xl font-bold tracking-tight">Tupply API Access</h1>
                  <p class="text-sm text-gray-400 mt-2">Restricted Area. Please authenticate.</p>
              </div>

              ${errorMsg ? `<div class="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-lg mb-6 text-center">${errorMsg}</div>` : ''}

              <form action="/docs/login" method="POST" class="space-y-5">
                  <div>
                      <label class="block text-sm font-medium text-gray-300 mb-1">Username</label>
                      <input type="text" name="username" required class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-600" placeholder="Enter admin username">
                  </div>
                  <div>
                      <label class="block text-sm font-medium text-gray-300 mb-1">Password</label>
                      <input type="password" name="password" required class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-600" placeholder="••••••••">
                  </div>
                  <button type="submit" class="w-full bg-white text-black font-semibold rounded-lg px-4 py-2.5 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 focus:ring-white transition-all transform active:scale-[0.98]">
                      Akses Dokumentasi
                  </button>
              </form>
          </div>
      </body>
      </html>
    `;
    }
    getLoginPage(req, res) {
        const session = req.cookies['tupply_docs_session'];
        if (session && process.env.JWT_SECRET && session === process.env.JWT_SECRET) {
            return res.redirect('/api/docs');
        }
        return res.type('text/html').send(this.renderLoginHtml());
    }
    postLogin(body, res) {
        const { username, password } = body;
        const validUser = 'admin';
        const validPass = 'tupply2026';
        if (username === validUser && password === validPass) {
            res.cookie('tupply_docs_session', process.env.JWT_SECRET, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 1000 * 60 * 60 * 24
            });
            return res.redirect('/api/docs');
        }
        return res.type('text/html').send(this.renderLoginHtml('Username atau password salah!'));
    }
    logout(res) {
        res.clearCookie('tupply_docs_session');
        return res.redirect('/docs/login');
    }
};
exports.DocsController = DocsController;
__decorate([
    (0, common_1.Get)('login'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], DocsController.prototype, "getLoginPage", null);
__decorate([
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], DocsController.prototype, "postLogin", null);
__decorate([
    (0, common_1.Get)('logout'),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DocsController.prototype, "logout", null);
exports.DocsController = DocsController = __decorate([
    (0, common_1.Controller)('docs')
], DocsController);
//# sourceMappingURL=docs.controller.js.map