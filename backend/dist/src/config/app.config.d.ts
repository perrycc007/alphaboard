export declare const appConfig: (() => {
    port: number;
    environment: string;
}) & import("@nestjs/config").ConfigFactoryKeyHost<{
    port: number;
    environment: string;
}>;
export declare const polygonConfig: (() => {
    apiKey: string;
    wsUrl: string;
    restUrl: string;
}) & import("@nestjs/config").ConfigFactoryKeyHost<{
    apiKey: string;
    wsUrl: string;
    restUrl: string;
}>;
export declare const databaseConfig: (() => {
    url: string;
}) & import("@nestjs/config").ConfigFactoryKeyHost<{
    url: string;
}>;
