package ie.gavinhoran.fitnessclockbridge;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.provider.AlarmClock;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** No alarm service: this activity only requests a timer from Google Clock. */
public final class BridgeActivity extends Activity {
    public static final String CLOCK_PACKAGE = "com.google.android.deskclock";
    private TextView message;
    private Button start;
    private TimerRequest request;

    @Override public void onCreate(Bundle state) { super.onCreate(state); showRequest(); }
    @Override public void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); showRequest(); }

    private void showRequest() {
        ScrollView scroll = new ScrollView(this);
        LinearLayout layout = new LinearLayout(this); layout.setOrientation(LinearLayout.VERTICAL);
        int pad = (int)(24 * getResources().getDisplayMetrics().density); layout.setPadding(pad, pad, pad, pad);
        scroll.addView(layout); setContentView(scroll);
        TextView title = new TextView(this); title.setTextSize(28); title.setText("Fitness → Google Clock"); layout.addView(title);
        message = new TextView(this); message.setTextSize(18); message.setPadding(0, pad, 0, pad); layout.addView(message);
        start = new Button(this); start.setText("Open timer in Google Clock"); start.setMinHeight((int)(56 * getResources().getDisplayMetrics().density)); layout.addView(start);
        TextView limits = new TextView(this); limits.setTextSize(16); limits.setPadding(0, pad, 0, pad);
        limits.setText("Google Clock may start the timer immediately. Check its countdown before switching to Spotify. Pause, reset and dismiss there; website controls cannot change this timer. This preview has not been verified on your phone."); layout.addView(limits);
        Button back = new Button(this); back.setText("Return to Fitness"); layout.addView(back);
        back.setOnClickListener(v -> { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://gwavin.github.io/Fitness/plans/fitness-v2/index.html"))); finish(); });
        try {
            request = TimerRequest.parse(getIntent().getData(), System.currentTimeMillis());
            if (attempted(request.id)) {
                start.setEnabled(false); message.setText("This request was already handed off. Check Google Clock before starting another timer.");
            } else message.setText("Requested duration: " + request.clock() + "\n\nTap below to request this timer in Google Clock. No timer has been started by this bridge yet.");
        } catch (IllegalArgumentException error) {
            request = null; start.setEnabled(false);
            message.setText(getIntent().getData() == null ? "Open Fitness in Chrome and tap its Google Clock button to send a duration here." : error.getMessage());
        }
        start.setOnClickListener(v -> sendToClock());
    }

    public static Intent clockIntent(TimerRequest request) {
        return new Intent(AlarmClock.ACTION_SET_TIMER).setPackage(CLOCK_PACKAGE)
                .putExtra(AlarmClock.EXTRA_LENGTH, request.seconds)
                .putExtra(AlarmClock.EXTRA_MESSAGE, "Fitness rest")
                .putExtra(AlarmClock.EXTRA_SKIP_UI, false);
    }

    private SharedPreferences records() { return getSharedPreferences("handoffs", MODE_PRIVATE); }
    private boolean attempted(String id) { return records().contains("request:" + id); }
    private void sendToClock() {
        try {
            // Revalidate at confirmation, including a link left open too long.
            request = TimerRequest.parse(getIntent().getData(), System.currentTimeMillis());
            if (attempted(request.id)) { start.setEnabled(false); message.setText("Already handed off. Check Google Clock."); return; }
            Intent intent = clockIntent(request);
            if (intent.resolveActivity(getPackageManager()) == null) { message.setText("Google Clock is missing, disabled or does not accept timer requests. No timer was sent. Open Google Clock manually."); return; }
            SharedPreferences.Editor edit = records().edit();
            long now = System.currentTimeMillis();
            for (String key : records().getAll().keySet()) if (records().getLong(key, 0) < now - 600_000) edit.remove(key);
            // Record the attempt before launching: rotation/back/repeated intents must not resend it.
            if (!edit.putLong("request:" + request.id, now).commit()) { message.setText("Could not record this handoff safely. No timer was sent. Open Google Clock manually."); return; }
            start.setEnabled(false);
            try {
                startActivity(intent);
                message.setText("Request sent for " + request.clock() + ". Verify the timer in Google Clock; this app cannot confirm whether it started or whether an alert will be audible.");
            } catch (ActivityNotFoundException | SecurityException error) {
                // These launch failures cannot have created a timer. Allow a deliberate retry.
                records().edit().remove("request:" + request.id).commit(); start.setEnabled(true);
                message.setText("Android blocked the handoff. No timer was sent. Open Google Clock manually.");
            }
        } catch (IllegalArgumentException error) { start.setEnabled(false); message.setText(error.getMessage()); }
    }
}
