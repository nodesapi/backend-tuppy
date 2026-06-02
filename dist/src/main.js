"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const swagger_1 = require("@nestjs/swagger");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.use((0, cookie_parser_1.default)());
    app.use('/api/docs', (req, res, next) => {
        const session = req.cookies['tupply_docs_session'];
        if (session === process.env.JWT_SECRET) {
            next();
        }
        else {
            res.redirect('/docs/login');
        }
    });
    app.use('/api/docs-json', (req, res, next) => {
        const session = req.cookies['tupply_docs_session'];
        if (session === process.env.JWT_SECRET) {
            next();
        }
        else {
            res.status(401).send('Unauthorized');
        }
    });
    const config = new swagger_1.DocumentBuilder()
        .setTitle('tupp.ly Backend API')
        .setDescription('Dokumentasi API untuk platform tupp.ly (Zero-Fee Creator & Commerce Hub)')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api/docs', app, document);
    app.enableCors();
    await app.listen(process.env.PORT ?? 3000);
    console.log(`Application is running on: ${await app.getUrl()}`);
    console.log(`Swagger UI is available at: ${await app.getUrl()}/api/docs`);
}
bootstrap();
//# sourceMappingURL=main.js.map