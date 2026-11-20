package com.slaxy.pineappleclient;

import com.slaxy.pineappleclient.mixin.SimpleOptionAccessor;
import net.minecraft.client.MinecraftClient;

public class Fullbright {
    private static final double BRIGHT = 16.0;
    private static boolean active = false;
    private static double savedGamma = 1.0;

    public static void tick(MinecraftClient client) {
        if (PineappleClient.CONFIG.fullbright && !active) {
            savedGamma = client.options.getGamma().getValue();
            set(client, BRIGHT);
            active = true;
        } else if (!PineappleClient.CONFIG.fullbright && active) {
            set(client, savedGamma);
            active = false;
        }
    }

    public static void restore(MinecraftClient client) {
        if (active) {
            set(client, savedGamma);
            active = false;
        }
    }

    @SuppressWarnings("unchecked")
    private static void set(MinecraftClient client, double value) {
        ((SimpleOptionAccessor<Double>) (Object) client.options.getGamma()).pineappleclient$setValue(value);
    }
}
