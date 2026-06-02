import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { EmailService } from '../email/email.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/create-order.dto';
export declare class OrdersService {
    private readonly prisma;
    private readonly whatsappService;
    private readonly emailService;
    constructor(prisma: PrismaService, whatsappService: WhatsappService, emailService: EmailService);
    checkout(dto: CreateOrderDto): Promise<{
        success: boolean;
        order: ({
            items: {
                id: string;
                blockId: string | null;
                orderId: string;
                productName: string;
                imageUrl: string | null;
                price: number;
                quantity: number;
                subtotal: number;
            }[];
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            paymentMethod: string | null;
            tenantId: string;
            grandTotal: number;
            platformFee: number;
            netAmount: number;
            customerName: string;
            customerPhone: string;
            customerEmail: string | null;
            shippingAddress: string | null;
            notes: string | null;
            channel: string;
            internalNote: string | null;
            awbNumber: string | null;
            courier: string | null;
            orderNumber: string;
            paymentGateway: string | null;
            paymentLink: string | null;
            waSent: boolean;
        }) | null;
        waLink: string | null;
    }>;
    getMyOrders(userId: string, status?: string): Promise<({
        items: {
            id: string;
            blockId: string | null;
            orderId: string;
            productName: string;
            imageUrl: string | null;
            price: number;
            quantity: number;
            subtotal: number;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        paymentMethod: string | null;
        tenantId: string;
        grandTotal: number;
        platformFee: number;
        netAmount: number;
        customerName: string;
        customerPhone: string;
        customerEmail: string | null;
        shippingAddress: string | null;
        notes: string | null;
        channel: string;
        internalNote: string | null;
        awbNumber: string | null;
        courier: string | null;
        orderNumber: string;
        paymentGateway: string | null;
        paymentLink: string | null;
        waSent: boolean;
    })[]>;
    getOrderDetail(orderId: string, userId: string): Promise<{
        items: {
            id: string;
            blockId: string | null;
            orderId: string;
            productName: string;
            imageUrl: string | null;
            price: number;
            quantity: number;
            subtotal: number;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        paymentMethod: string | null;
        tenantId: string;
        grandTotal: number;
        platformFee: number;
        netAmount: number;
        customerName: string;
        customerPhone: string;
        customerEmail: string | null;
        shippingAddress: string | null;
        notes: string | null;
        channel: string;
        internalNote: string | null;
        awbNumber: string | null;
        courier: string | null;
        orderNumber: string;
        paymentGateway: string | null;
        paymentLink: string | null;
        waSent: boolean;
    }>;
    updateOrderStatus(orderId: string, dto: UpdateOrderStatusDto, userId: string): Promise<{
        items: {
            id: string;
            blockId: string | null;
            orderId: string;
            productName: string;
            imageUrl: string | null;
            price: number;
            quantity: number;
            subtotal: number;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        paymentMethod: string | null;
        tenantId: string;
        grandTotal: number;
        platformFee: number;
        netAmount: number;
        customerName: string;
        customerPhone: string;
        customerEmail: string | null;
        shippingAddress: string | null;
        notes: string | null;
        channel: string;
        internalNote: string | null;
        awbNumber: string | null;
        courier: string | null;
        orderNumber: string;
        paymentGateway: string | null;
        paymentLink: string | null;
        waSent: boolean;
    }>;
    private generateWaText;
    getPendingCount(userId: string): Promise<{
        count: number;
    }>;
    trackOrder(orderNumber: string, phone: string): Promise<{
        tenant: {
            displayName: string;
        };
        items: {
            id: string;
            blockId: string | null;
            orderId: string;
            productName: string;
            imageUrl: string | null;
            price: number;
            quantity: number;
            subtotal: number;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        paymentMethod: string | null;
        tenantId: string;
        grandTotal: number;
        platformFee: number;
        netAmount: number;
        customerName: string;
        customerPhone: string;
        customerEmail: string | null;
        shippingAddress: string | null;
        notes: string | null;
        channel: string;
        internalNote: string | null;
        awbNumber: string | null;
        courier: string | null;
        orderNumber: string;
        paymentGateway: string | null;
        paymentLink: string | null;
        waSent: boolean;
    }>;
}
