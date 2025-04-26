import { Command } from "commander";
import {
    DEFAULT_CONFIG_DIRECTORY,
} from "./constants";
import { ArgumentError } from "./error/ArgumentError";
import { Args, Config } from "./givemetheconfig";
import { Options } from "./options";
import * as Storage from "./util/storage";
import { z } from "zod";
export { ArgumentError };

export const create = <T extends z.ZodRawShape>(options: Options<T>): {
    configure: (command: Command) => Promise<Command>;
    validate: (args: Args) => Promise<Config>;
} => {

    const configure = async (command: Command): Promise<Command> => {
        let retCommand = command;
        retCommand = retCommand.option('-c, --config-directory <configDirectory>', 'Config Directory', options.defaults?.configDirectory || DEFAULT_CONFIG_DIRECTORY)
        return retCommand;
    }

    const validate = async (args: Args): Promise<Config> => {

        const config: Partial<Config> = {};


        if (options.isFeatureEnabled('config') && args.configDirectory) {
            await validateConfigDirectory(args.configDirectory);
            config.configDirectory = args.configDirectory ?? DEFAULT_CONFIG_DIRECTORY;
        }

        return config as Config;
    }


    const validateConfigDirectory = async (configDirectory: string) => {
        // eslint-disable-next-line no-console
        const storage = Storage.create({ log: console.log });
        if (!storage.isDirectoryReadable(configDirectory)) {
            throw new Error(`Config directory does not exist: ${configDirectory}`);
        }
    }


    return {
        configure,
        validate,
    }
}




