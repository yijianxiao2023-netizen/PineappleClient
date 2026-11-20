package com.slaxy.pineappleclient;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.io.Reader;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;

public class Config {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Path PATH = FabricLoader.getInstance().getConfigDir().resolve("pineappleclient.json");

    public boolean showFps = true;
    public boolean showCoords = true;
    public boolean showCps = true;
    public boolean showKeystrokes = true;
    public boolean showArmor = true;
    public boolean fullbright = false;
    public boolean toggleSprint = false;
    public boolean smoothZoom = true;
    public double zoomFactor = 4.0;
    public int textColor = 0xFFFFFF;
    public int accentColor = 0xFFD84D;

    public static Config load() {
        if (Files.exists(PATH)) {
            try (Reader r = Files.newBufferedReader(PATH)) {
                Config c = GSON.fromJson(r, Config.class);
                if (c != null) return c;
            } catch (Exception e) {
                PineappleClient.LOGGER.warn("Could not read config, using defaults", e);
            }
        }
        Config c = new Config();
        c.save();
        return c;
    }

    public void save() {
        try {
            Files.createDirectories(PATH.getParent());
            try (Writer w = Files.newBufferedWriter(PATH)) {
                GSON.toJson(this, w);
            }
        } catch (Exception e) {
            PineappleClient.LOGGER.warn("Could not save config", e);
        }
    }
}
