import { Command } from "commander";
import { z } from "zod";
import { ArgumentError } from "./error/ArgumentError";
import { Options } from "./types";
export { ArgumentError };

export const configure = async <T extends z.ZodRawShape>(command: Command, options: Options<T>): Promise<Command> => {
    let retCommand = command;
    retCommand = retCommand.option('-c, --config-directory <configDirectory>', 'Config Directory', options.defaults.configDirectory)
    return retCommand;
}




