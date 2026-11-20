package com.slaxy.pineappleclient;

import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;

import java.util.function.Consumer;
import java.util.function.Supplier;

public class SettingsScreen extends Screen {
    private final Screen parent;

    public SettingsScreen(Screen parent) {
        super(Text.literal("PineappleClient"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        Config c = PineappleClient.CONFIG;
        int w = 150;
        int h = 20;
        int left = this.width / 2 - w - 5;
        int right = this.width / 2 + 5;
        int top = this.height / 4;

        toggle(left, top, w, h, "FPS", () -> c.showFps, v -> c.showFps = v);
        toggle(right, top, w, h, "Coordinates", () -> c.showCoords, v -> c.showCoords = v);
        toggle(left, top + 24, w, h, "CPS", () -> c.showCps, v -> c.showCps = v);
        toggle(right, top + 24, w, h, "Keystrokes", () -> c.showKeystrokes, v -> c.showKeystrokes = v);
        toggle(left, top + 48, w, h, "Armor HUD", () -> c.showArmor, v -> c.showArmor = v);
        toggle(right, top + 48, w, h, "Fullbright", () -> c.fullbright, v -> c.fullbright = v);
        toggle(left, top + 72, w, h, "Toggle Sprint", () -> c.toggleSprint, v -> c.toggleSprint = v);
        toggle(right, top + 72, w, h, "Smooth Zoom", () -> c.smoothZoom, v -> c.smoothZoom = v);

        addDrawableChild(ButtonWidget.builder(zoomLabel(), b -> {
            c.zoomFactor = c.zoomFactor >= 10 ? 2 : c.zoomFactor + 1;
            b.setMessage(zoomLabel());
        }).dimensions(left, top + 96, w * 2 + 10, h).build());

        addDrawableChild(ButtonWidget.builder(Text.literal("Done"), b -> close())
                .dimensions(this.width / 2 - 100, top + 132, 200, h).build());
    }

    private Text zoomLabel() {
        return Text.literal("Zoom Strength: " + (int) PineappleClient.CONFIG.zoomFactor + "x");
    }

    private void toggle(int x, int y, int w, int h, String name, Supplier<Boolean> get, Consumer<Boolean> set) {
        addDrawableChild(ButtonWidget.builder(label(name, get.get()), b -> {
            set.accept(!get.get());
            b.setMessage(label(name, get.get()));
        }).dimensions(x, y, w, h).build());
    }

    private static Text label(String name, boolean on) {
        return Text.literal(name + ": " + (on ? "§aON" : "§cOFF"));
    }

    @Override
    public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
        super.render(ctx, mouseX, mouseY, delta);
        ctx.drawCenteredTextWithShadow(this.textRenderer, "§ePineapple§fClient", this.width / 2, this.height / 4 - 30, 0xFFFFFF);
        ctx.drawCenteredTextWithShadow(this.textRenderer, "§7Rebind keys in Options > Controls > Key Binds > PineappleClient",
                this.width / 2, this.height / 4 - 16, 0xFFFFFF);
    }

    @Override
    public void close() {
        PineappleClient.CONFIG.save();
        if (this.client != null) this.client.setScreen(parent);
    }
}
