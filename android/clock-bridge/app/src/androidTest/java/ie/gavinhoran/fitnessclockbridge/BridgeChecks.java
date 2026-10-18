package ie.gavinhoran.fitnessclockbridge;

import android.app.Instrumentation;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.provider.AlarmClock;

/** Dependency-free API-boundary checks on an emulator/device, not an audio test. */
public final class BridgeChecks extends Instrumentation {
    private int checks;
    @Override public void onCreate(Bundle args) { super.onCreate(args); start(); }
    private void check(boolean ok, String message) { if (!ok) throw new AssertionError(message); checks++; }
    private void rejects(String uri, long now) {
        try { TimerRequest.parse(Uri.parse(uri), now); throw new AssertionError("Accepted invalid URI: " + uri); }
        catch (IllegalArgumentException expected) { checks++; }
    }
    @Override public void onStart() {
        Bundle result = new Bundle();
        try {
            long now = 1792321200000L;
            String base = "fitnessclock://timer?seconds=90&requestId=12345678-1234-1234-1234-123456789abc&issuedAt=" + now;
            TimerRequest r = TimerRequest.parse(Uri.parse(base), now);
            check(r.seconds == 90 && "01:30".equals(r.clock()), "duration and display");
            Intent intent = BridgeActivity.clockIntent(r);
            check(AlarmClock.ACTION_SET_TIMER.equals(intent.getAction()), "native timer action");
            check("com.google.android.deskclock".equals(intent.getPackage()), "Google Clock only");
            check(intent.getIntExtra(AlarmClock.EXTRA_LENGTH, -1) == 90, "integer duration");
            check("Fitness rest".equals(intent.getStringExtra(AlarmClock.EXTRA_MESSAGE)), "generic private label");
            check(!intent.getBooleanExtra(AlarmClock.EXTRA_SKIP_UI, true), "show Clock UI");
            check(intent.getExtras().size() == 3, "no workout data or external component");
            rejects(base.replace("seconds=90", "seconds=0"), now);
            rejects(base.replace("seconds=90", "seconds=3601"), now);
            rejects(base.replace("seconds=90", "seconds=1.5"), now);
            rejects(base.replace("seconds=90", "seconds=90&seconds=120"), now);
            rejects(base + "&package=malicious", now);
            rejects(base.replace("fitnessclock:", "https:"), now);
            rejects(base.replace("//timer?", "//other?"), now);
            rejects(base.replace("//timer?", "//user@timer?"), now);
            rejects(base + "#fragment", now);
            rejects(base.replace("//timer?", "//timer/path?"), now);
            rejects(base, now + 120001);
            rejects(base, now - 10001);
            rejects(base.replace("12345678-1234-1234-1234-123456789abc", "bad"), now);
            result.putString("stream", "PASS: " + checks + " native protocol/intent checks. Clock delivery/audio NOT tested.\n"); finish(-1, result);
        } catch (Throwable failure) { result.putString("stream", "FAIL: " + failure.toString() + "\n"); finish(0, result); }
    }
}
