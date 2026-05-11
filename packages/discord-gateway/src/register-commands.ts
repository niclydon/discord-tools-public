import "dotenv/config";
import { REST, Routes, SlashCommandBuilder } from "discord.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
if (!config.DISCORD_APPLICATION_ID) {
  throw new Error("DISCORD_APPLICATION_ID is required to register slash commands");
}

const commands = [
  new SlashCommandBuilder()
    .setName("gateway-status")
    .setDescription("Show local gateway status"),
  new SlashCommandBuilder()
    .setName("gateway-routes")
    .setDescription("Show configured gateway routes")
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(config.DISCORD_BOT_TOKEN);
await rest.put(
  Routes.applicationGuildCommands(config.DISCORD_APPLICATION_ID, config.DISCORD_GUILD_ID),
  { body: commands }
);

console.log(`Registered ${commands.length} guild command(s).`);
