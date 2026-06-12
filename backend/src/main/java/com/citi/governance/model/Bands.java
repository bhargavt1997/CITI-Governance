package com.citi.governance.model;

import java.util.List;

/**
 * Career bands. Stored lowercase (e.g. "b6h"); the UI displays them uppercase (B6H).
 * Manager-eligible bands and developer bands form a clean split.
 */
public final class Bands {
    private Bands() {}

    /** All bands, in display order. */
    public static final List<String> ALL = List.of("b8", "b7", "b6l", "b6h", "b5l", "b5h", "b4l", "b4h");
    /** Bands eligible to act as managers. */
    public static final List<String> MANAGER = List.of("b6h", "b5l", "b5h", "b4l", "b4h");
    /** Bands for developers (the remaining bands). */
    public static final List<String> DEVELOPER = List.of("b8", "b7", "b6l");
    /** Senior-manager bands (manager bands above b6h). */
    public static final List<String> SENIOR = List.of("b5l", "b5h", "b4l", "b4h");
    public static final String DEFAULT_MANAGER = "b6h";

    /** Seniority rank by band order (b8 lowest .. b4h highest). Higher = more senior. */
    public static int rank(String band) { return ALL.indexOf(band); }

    public static boolean isManagerBand(String band) { return MANAGER.contains(band); }
    public static boolean isDeveloperBand(String band) { return DEVELOPER.contains(band); }
    public static boolean isSeniorBand(String band) { return SENIOR.contains(band); }
    public static boolean isValid(String band) { return ALL.contains(band); }
}
