import { Controller, Get, Post, Body, Res, Req } from '@nestjs/common';
import type { Request, Response } from 'express';

@Controller('docs')
export class DocsController {
  
  // Halaman HTML estetik untuk Login
  private renderLoginHtml(errorMsg = '') {
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

  @Get('login')
  getLoginPage(@Req() req: Request, @Res() res: Response) {
    // Jika sudah punya cookie yang valid, langsung arahkan ke docs
    const session = req.cookies['tupply_docs_session'];
    if (session && process.env.JWT_SECRET && session === process.env.JWT_SECRET) {
      return res.redirect('/api/docs');
    }
    return res.type('text/html').send(this.renderLoginHtml());
  }

  @Post('login')
  postLogin(@Body() body: any, @Res() res: Response) {
    const { username, password } = body;
    
    // Verifikasi credentials (sementara hardcode untuk API Docs protection)
    const validUser = 'admin';
    const validPass = 'tupply2026';

    if (username === validUser && password === validPass) {
      // Set cookie (aman, httpOnly)
      res.cookie('tupply_docs_session', process.env.JWT_SECRET, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 // 1 hari
      });
      return res.redirect('/api/docs');
    }

    return res.type('text/html').send(this.renderLoginHtml('Username atau password salah!'));
  }

  @Get('logout')
  logout(@Res() res: Response) {
    res.clearCookie('tupply_docs_session');
    return res.redirect('/docs/login');
  }
}
