import { Command } from "commander";
import { ZodObject } from "zod";

import { z } from "zod";

export type Feature = 'config';

export interface DefaultOptions {
    configDirectory: string;
    configFile: string;
    isRequired: boolean;
    encoding: string;
}

// Use ZodRawShape for easier merging later
export interface Options<T extends z.ZodRawShape> {
    defaults: DefaultOptions,
    features: Feature[],
    configShape: T; // User-defined configuration shape
    logger: Logger;
}

export interface Logger {
    debug: (message: string, ...args: any[]) => void;
    info: (message: string, ...args: any[]) => void;
    warn: (message: string, ...args: any[]) => void;
    error: (message: string, ...args: any[]) => void;
    verbose: (message: string, ...args: any[]) => void;
    silly: (message: string, ...args: any[]) => void;
}

// Make interface generic
export interface Givemetheconfig<T extends z.ZodRawShape> {
    configure: (command: Command) => Promise<Command>;
    setLogger: (logger: Logger) => void;
    read: (args: Args) => Promise<z.infer<ZodObject<T & typeof ConfigSchema.shape>>>;
    validate: (config: z.infer<ZodObject<T & typeof ConfigSchema.shape>>) => Promise<void>;
}

export interface Args {
    [key: string]: any;
}

// Base schema for core options
export const ConfigSchema = z.object({
    configDirectory: z.string(),
});

export type Config = z.infer<typeof ConfigSchema>;
