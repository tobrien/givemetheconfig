import { Command } from 'commander';
import { configure } from './configure';
import { validate } from './validate';
import { read } from './read';
import { z, ZodObject } from 'zod';
import { DEFAULT_CONFIG_DIRECTORY } from './constants';
export interface Logger {
    debug: (message: string, ...args: any[]) => void;
    info: (message: string, ...args: any[]) => void;
    warn: (message: string, ...args: any[]) => void;
    error: (message: string, ...args: any[]) => void;
    verbose: (message: string, ...args: any[]) => void;
    silly: (message: string, ...args: any[]) => void;
}

export type Feature = 'config';

export interface DefaultOptions {
    configDirectory?: string;
}

// Use ZodRawShape for easier merging later
export interface Options<T extends z.ZodRawShape> {
    defaults?: DefaultOptions,
    features: Feature[],
    configShape: T; // User-defined configuration shape
    logger: Logger;
}

export const DEFAULT_APP_OPTIONS: DefaultOptions = {
    configDirectory: DEFAULT_CONFIG_DIRECTORY,
}

export const DEFAULT_FEATURES: Feature[] = ['config'];

export const DEFAULT_LOGGER: Logger = {
    // eslint-disable-next-line no-console
    debug: console.debug,
    // eslint-disable-next-line no-console
    info: console.info,
    // eslint-disable-next-line no-console
    warn: console.warn,
    // eslint-disable-next-line no-console
    error: console.error,
    // eslint-disable-next-line no-console
    verbose: console.log,
    // eslint-disable-next-line no-console
    silly: console.log,
}

// Make interface generic
export interface Givemetheconfig<T extends z.ZodRawShape> {
    configure: (command: Command) => Promise<Command>;
    setLogger: (logger: Logger) => void;
    read: (args: Args) => Promise<z.infer<ZodObject<T & typeof ConfigSchema.shape>>>;
    validate: (args: Args) => Promise<z.infer<ZodObject<T & typeof ConfigSchema.shape>>>;
}

export interface Args {
    [key: string]: any;
}

// Base schema for core options
export const ConfigSchema = z.object({
    configDirectory: z.string(),
});

export type Config = z.infer<typeof ConfigSchema>;

// Make create function generic
export const create = <T extends z.ZodRawShape>(pOptions: {
    defaults?: DefaultOptions,
    features?: Feature[],
    configShape: T, // Make configShape mandatory
    logger?: Logger,
}): Givemetheconfig<T> => {


    const defaults = pOptions.defaults || DEFAULT_APP_OPTIONS;
    const features = pOptions.features || DEFAULT_FEATURES;
    const configShape = pOptions.configShape;
    let logger = pOptions.logger || DEFAULT_LOGGER;

    const options: Options<T> = {
        defaults,
        features,
        configShape, // Store the shape
        logger,
    }

    const setLogger = (pLogger: Logger) => {
        logger = pLogger;
        options.logger = pLogger;
    }

    return {
        setLogger,
        configure: (command: Command) => configure(command, options),
        validate: (args: Args) => validate(args, options),
        read: (args: Args) => read(args, options),
    }
}





