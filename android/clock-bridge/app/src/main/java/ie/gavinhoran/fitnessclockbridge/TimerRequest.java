package ie.gavinhoran.fitnessclockbridge;

import android.net.Uri;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/** Strict, data-only protocol. Never accepts components, packages or free text. */
public final class TimerRequest {
    public static final long MAX_AGE_MS = 120_000L;
    public final int seconds;
    public final String id;
    public final long issuedAt;

    private TimerRequest(int seconds, String id, long issuedAt) {
        this.seconds = seconds; this.id = id; this.issuedAt = issuedAt;
    }

    public static TimerRequest parse(Uri uri, long now) {
        if (uri == null || !uri.isHierarchical() || !"fitnessclock".equals(uri.getScheme())
                || !"timer".equals(uri.getHost()) || uri.getPort() != -1
                || uri.getUserInfo() != null || (uri.getPath() != null && !uri.getPath().isEmpty())
                || uri.getFragment() != null) throw new IllegalArgumentException("Unrecognised timer link.");
        Set<String> expected = new HashSet<>(Arrays.asList("seconds", "requestId", "issuedAt"));
        if (!uri.getQueryParameterNames().equals(expected)) throw new IllegalArgumentException("Invalid timer parameters.");
        for (String name : expected) if (uri.getQueryParameters(name).size() != 1)
            throw new IllegalArgumentException("Duplicate timer parameter.");
        String duration = uri.getQueryParameter("seconds"), id = uri.getQueryParameter("requestId");
        String issued = uri.getQueryParameter("issuedAt");
        if (duration == null || !duration.matches("[0-9]{1,4}")) throw new IllegalArgumentException("Invalid duration.");
        int seconds = Integer.parseInt(duration);
        if (seconds < 15 || seconds > 3600) throw new IllegalArgumentException("Choose a timer from 15 seconds to 60 minutes.");
        if (id == null || !id.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
                || !UUID.fromString(id).toString().equals(id)) throw new IllegalArgumentException("Invalid request ID.");
        if (issued == null || !issued.matches("[0-9]{13}")) throw new IllegalArgumentException("Invalid request time.");
        long issuedAt = Long.parseLong(issued), age = now - issuedAt;
        if (age < -10_000 || age > MAX_AGE_MS) throw new IllegalArgumentException("This request expired. Return to Fitness and tap Google Clock again.");
        return new TimerRequest(seconds, id, issuedAt);
    }

    public String clock() { return String.format(Locale.ROOT, "%02d:%02d", seconds / 60, seconds % 60); }
}
