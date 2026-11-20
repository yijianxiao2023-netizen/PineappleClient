package com.slaxy.pineappleclient;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.render.RenderTickCounter;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.util.math.BlockPos;

public class HudRenderer {
    private static final int PRESSED_BG = 0xB0FFFFFF;
    private static final int RELEASED_BG = 0x70000000;

    public static void render(DrawContext ctx, RenderTickCounter tickCounter) {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (mc.player == null || mc.options.hudHidden || mc.getDebugHud().shouldShowDebugHud()) return;

        Config cfg = PineappleClient.CONFIG;
        TextRenderer tr = mc.textRenderer;
        int x = 4;
        int y = 4;

        if (cfg.showFps) {
            y = line(ctx, tr, x, y, "FPS", String.valueOf(mc.getCurrentFps()));
        }
        if (cfg.showCoords) {
            BlockPos p = mc.player.getBlockPos();
            y = line(ctx, tr, x, y, "XYZ", p.getX() + " " + p.getY() + " " + p.getZ());
            y = line(ctx, tr, x, y, "Facing", capitalize(mc.player.getHorizontalFacing().asString()));
        }
        if (cfg.showCps) {
            y = line(ctx, tr, x, y, "CPS", CpsTracker.left() + " | " + CpsTracker.right());
        }
        if (cfg.fullbright) {
            y = line(ctx, tr, x, y, "Fullbright", "ON");
        }
        if (cfg.toggleSprint) {
            y = line(ctx, tr, x, y, "Sprint", mc.player.isSprinting() ? "Sprinting" : "Toggled");
        }

        if (cfg.showKeystrokes) {
            drawKeystrokes(ctx, tr, mc, x, y + 4);
        }
        if (cfg.showArmor) {
            drawArmor(ctx, tr, mc.player, ctx.getScaledWindowWidth(), ctx.getScaledWindowHeight());
        }
    }

    private static int line(DrawContext ctx, TextRenderer tr, int x, int y, String label, String value) {
        String l = label + ": ";
        ctx.drawTextWithShadow(tr, l, x, y, PineappleClient.CONFIG.accentColor);
        ctx.drawTextWithShadow(tr, value, x + tr.getWidth(l), y, PineappleClient.CONFIG.textColor);
        return y + tr.fontHeight + 2;
    }

    private static void drawKeystrokes(DrawContext ctx, TextRenderer tr, MinecraftClient mc, int x, int y) {
        int s = 22;
        int g = 2;
        key(ctx, tr, mc.options.forwardKey, "W", x + s + g, y, s, s);
        key(ctx, tr, mc.options.leftKey, "A", x, y + s + g, s, s);
        key(ctx, tr, mc.options.backKey, "S", x + s + g, y + s + g, s, s);
        key(ctx, tr, mc.options.rightKey, "D", x + (s + g) * 2, y + s + g, s, s);

        int full = s * 3 + g * 2;
        int half = (full - g) / 2;
        int my = y + (s + g) * 2;
        key(ctx, tr, mc.options.attackKey, "LMB", x, my, half, s);
        key(ctx, tr, mc.options.useKey, "RMB", x + half + g, my, full - half - g, s);
        key(ctx, tr, mc.options.jumpKey, "SPACE", x, my + s + g, full, 12);
    }

    private static void key(DrawContext ctx, TextRenderer tr, KeyBinding kb, String label, int x, int y, int w, int h) {
        boolean down = kb.isPressed();
        ctx.fill(x, y, x + w, y + h, down ? PRESSED_BG : RELEASED_BG);
        int color = down ? 0x000000 : 0xFFFFFF;
        int tx = x + (w - tr.getWidth(label)) / 2;
        int ty = y + (h - tr.fontHeight) / 2 + 1;
        ctx.drawText(tr, label, tx, ty, color, !down);
    }

    private static void drawArmor(DrawContext ctx, TextRenderer tr, PlayerEntity player, int sw, int sh) {
        EquipmentSlot[] slots = {EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET, EquipmentSlot.MAINHAND};
        int x = sw - 20;
        int y = sh / 2 - (slots.length * 18) / 2;
        for (EquipmentSlot slot : slots) {
            ItemStack stack = player.getEquippedStack(slot);
            if (!stack.isEmpty()) {
                ctx.drawItem(stack, x, y);
                ctx.drawItemInSlot(tr, stack, x, y);
                if (stack.isDamageable()) {
                    String left = String.valueOf(stack.getMaxDamage() - stack.getDamage());
                    ctx.drawTextWithShadow(tr, left, x - tr.getWidth(left) - 2, y + 4, durabilityColor(stack));
                }
            }
            y += 18;
        }
    }

    private static int durabilityColor(ItemStack stack) {
        float pct = 1f - (float) stack.getDamage() / stack.getMaxDamage();
        if (pct > 0.6f) return 0x55FF55;
        if (pct > 0.3f) return 0xFFFF55;
        return 0xFF5555;
    }

    private static String capitalize(String s) {
        return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
