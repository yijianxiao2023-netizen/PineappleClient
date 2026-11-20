package com.slaxy.pineappleclient;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientLifecycleEvents;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.text.Text;
import org.lwjgl.glfw.GLFW;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class PineappleClient implements ClientModInitializer {
    public static final String MOD_ID = "pineappleclient";
    public static final Logger LOGGER = LoggerFactory.getLogger("PineappleClient");
    public static Config CONFIG;

    private static final String CATEGORY = "category.pineappleclient";
    public static KeyBinding zoomKey;
    private static KeyBinding menuKey;
    private static KeyBinding fullbrightKey;
    private static KeyBinding sprintKey;

    private static boolean zooming = false;
    private static boolean savedSmoothCamera = false;

    @Override
    public void onInitializeClient() {
        CONFIG = Config.load();

        zoomKey = register("key.pineappleclient.zoom", GLFW.GLFW_KEY_C);
        menuKey = register("key.pineappleclient.menu", GLFW.GLFW_KEY_RIGHT_SHIFT);
        fullbrightKey = register("key.pineappleclient.fullbright", GLFW.GLFW_KEY_G);
        sprintKey = register("key.pineappleclient.togglesprint", GLFW.GLFW_KEY_V);

        HudRenderCallback.EVENT.register(HudRenderer::render);
        ClientTickEvents.END_CLIENT_TICK.register(PineappleClient::onTick);
        ClientLifecycleEvents.CLIENT_STOPPING.register(client -> Fullbright.restore(client));

        LOGGER.info("PineappleClient loaded");
    }

    private static KeyBinding register(String name, int key) {
        return KeyBindingHelper.registerKeyBinding(new KeyBinding(name, InputUtil.Type.KEYSYM, key, CATEGORY));
    }

    private static void onTick(MinecraftClient client) {
        while (menuKey.wasPressed()) {
            client.setScreen(new SettingsScreen(client.currentScreen));
        }
        while (fullbrightKey.wasPressed()) {
            CONFIG.fullbright = !CONFIG.fullbright;
            CONFIG.save();
            notify(client, "Fullbright", CONFIG.fullbright);
        }
        while (sprintKey.wasPressed()) {
            CONFIG.toggleSprint = !CONFIG.toggleSprint;
            CONFIG.save();
            notify(client, "Toggle Sprint", CONFIG.toggleSprint);
        }

        Fullbright.tick(client);
        updateZoom(client);

        if (CONFIG.toggleSprint && client.player != null && client.currentScreen == null) {
            var p = client.player;
            boolean canSprint = client.options.forwardKey.isPressed()
                    && !p.isSneaking()
                    && !p.horizontalCollision
                    && (p.getHungerManager().getFoodLevel() > 6 || p.getAbilities().allowFlying)
                    && !p.isUsingItem();
            if (canSprint && !p.isSprinting()) {
                p.setSprinting(true);
            }
        }
    }

    private static void updateZoom(MinecraftClient client) {
        boolean wantZoom = zoomKey.isPressed() && client.currentScreen == null;
        if (wantZoom && !zooming) {
            zooming = true;
            savedSmoothCamera = client.options.smoothCameraEnabled;
            if (CONFIG.smoothZoom) client.options.smoothCameraEnabled = true;
        } else if (!wantZoom && zooming) {
            zooming = false;
            client.options.smoothCameraEnabled = savedSmoothCamera;
        }
    }

    public static boolean isZooming() {
        return zooming;
    }

    private static void notify(MinecraftClient client, String what, boolean on) {
        if (client.player != null) {
            client.player.sendMessage(Text.literal("§b[PineappleClient] §f" + what + ": " + (on ? "§aON" : "§cOFF")), true);
        }
    }
}
