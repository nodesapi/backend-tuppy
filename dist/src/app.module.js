"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const serve_static_1 = require("@nestjs/serve-static");
const path_1 = require("path");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const prisma_module_1 = require("./prisma/prisma.module");
const users_module_1 = require("./users/users.module");
const auth_module_1 = require("./auth/auth.module");
const tenant_module_1 = require("./tenant/tenant.module");
const pages_module_1 = require("./pages/pages.module");
const subscriptions_module_1 = require("./subscriptions/subscriptions.module");
const analytics_module_1 = require("./analytics/analytics.module");
const orders_module_1 = require("./orders/orders.module");
const wallet_module_1 = require("./wallet/wallet.module");
const leads_module_1 = require("./leads/leads.module");
const admin_module_1 = require("./admin/admin.module");
const tickets_module_1 = require("./tickets/tickets.module");
const whatsapp_module_1 = require("./whatsapp/whatsapp.module");
const email_module_1 = require("./email/email.module");
const docs_module_1 = require("./docs/docs.module");
const docs_middleware_1 = require("./docs/docs.middleware");
let AppModule = class AppModule {
    configure(consumer) {
        consumer
            .apply(docs_middleware_1.DocsMiddleware)
            .forRoutes('api/docs', 'api/docs-json');
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            serve_static_1.ServeStaticModule.forRoot({
                rootPath: (0, path_1.join)(process.cwd(), 'public'),
            }),
            prisma_module_1.PrismaModule,
            users_module_1.UsersModule,
            auth_module_1.AuthModule,
            tenant_module_1.TenantModule,
            pages_module_1.PagesModule,
            subscriptions_module_1.SubscriptionsModule,
            analytics_module_1.AnalyticsModule,
            orders_module_1.OrdersModule,
            wallet_module_1.WalletModule,
            leads_module_1.LeadsModule,
            admin_module_1.AdminModule,
            tickets_module_1.TicketsModule,
            whatsapp_module_1.WhatsappModule,
            email_module_1.EmailModule,
            docs_module_1.DocsModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map