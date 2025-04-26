import { DEFAULT_CONFIG_DIRECTORY } from "./constants";
import { z } from 'zod';

export { DEFAULT_CONFIG_DIRECTORY }; // Re-export the constant

export type Feature = 'config';

export interface DefaultOptions {
    configDirectory?: string;
    // Potentially add default values for user config here in the future?
}

// Use ZodRawShape for easier merging later
export interface Options<T extends z.ZodRawShape> {
    defaults?: DefaultOptions,
    isFeatureEnabled: (feature: Feature) => boolean;
    configShape: T; // User-defined configuration shape
}

export const DEFAULT_APP_OPTIONS: DefaultOptions = {
    configDirectory: DEFAULT_CONFIG_DIRECTORY,
}

export const DEFAULT_FEATURES: Feature[] = ['config'];

// Update createOptions to be generic and require configShape
export const createOptions = <T extends z.ZodRawShape>(
    options: {
        defaults?: DefaultOptions,
        features?: Feature[],
        configShape: T, // Make configShape mandatory
    }
): Options<T> => {

    const defaults = options.defaults || DEFAULT_APP_OPTIONS;
    const features = options.features || DEFAULT_FEATURES;
    const configShape = options.configShape;

    const isFeatureEnabled = (feature: Feature) => {
        return features.includes(feature);
    }

    return {
        defaults,
        isFeatureEnabled,
        configShape, // Store the shape
    }
}
