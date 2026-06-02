import { ExceptionFilter, ArgumentsHost, NotFoundException } from '@nestjs/common';
export declare class NotFoundExceptionFilter implements ExceptionFilter {
    catch(exception: NotFoundException, host: ArgumentsHost): void;
}
