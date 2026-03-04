import { Resend } from "resend";
import { WelcomeEmail } from "@/components/emails/welcome";
import { PasswordResetEmail } from "@/components/emails/password-reset";
import { AccessExpiredEmail } from "@/components/emails/access-expired";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "PLI Lernportal <pli@elevize.ai>";

export interface WelcomeEmailData {
  fullName: string;
  email: string;
  password?: string;
  passwordSetLink?: string;
  role: "admin" | "dozent" | "participant";
  courses?: { id: string; name: string }[];
  loginUrl?: string;
}

export interface PasswordResetEmailData {
  fullName: string;
  email: string;
  newPassword: string;
  loginUrl?: string;
}

export interface AccessExpiredEmailData {
  fullName: string;
  email: string;
  expiredCourses?: string[];
}

/**
 * Sends welcome email to new user based on their role
 */
export async function sendWelcomeEmail(data: WelcomeEmailData): Promise<void> {
  try {
    const loginUrl = data.loginUrl || "https://portal.loesungs-impulse.ch/login";

    const roleGreeting = data.role === "admin"
      ? "Ihr Admin-Zugang zum PLI Lernportal wurde erfolgreich eingerichtet."
      : data.role === "dozent"
      ? "Sie wurden als Dozent im PLI Lernportal freigeschaltet."
      : "Herzlich willkommen im Lernportal der Praxis für Lösungs-Impulse!";

    const coursesHtml = (data.courses && data.courses.length > 0 && data.role === "participant")
      ? `<div style="margin:24px 0"><h3 style="color:#0f766e;font-size:18px;margin-bottom:8px">Ihre zugewiesenen Kurse</h3><ul style="margin:0;padding:0 0 0 20px">${data.courses.map(c => `<li style="color:#374151;font-size:16px;line-height:24px">${c.name}</li>`).join("")}</ul></div>`
      : "";

    let credentialsHtml: string;
    if (data.passwordSetLink) {
      credentialsHtml = `
        <div style="background:#f0fdfa;border:1px solid #5eead4;border-radius:8px;padding:20px;margin:24px 0">
          <h3 style="color:#0f766e;font-size:18px;margin:0 0 8px">Ihre Zugangsdaten</h3>
          <p style="color:#1f2937;font-size:16px;margin:0"><strong>E-Mail:</strong> ${data.email}</p>
          <p style="color:#374151;font-size:16px;margin:12px 0">Bitte klicken Sie auf den folgenden Button, um Ihr persönliches Passwort festzulegen:</p>
          <div style="text-align:center;margin:24px 0">
            <a href="${data.passwordSetLink}" style="background:#0d9488;border-radius:8px;color:#fff;display:inline-block;font-size:16px;font-weight:bold;line-height:50px;text-decoration:none;padding:0 32px">Passwort setzen</a>
          </div>
        </div>`;
    } else if (data.password) {
      credentialsHtml = `
        <div style="background:#f0fdfa;border:1px solid #5eead4;border-radius:8px;padding:20px;margin:24px 0">
          <h3 style="color:#0f766e;font-size:18px;margin:0 0 8px">Ihre Zugangsdaten</h3>
          <p style="color:#1f2937;font-size:16px;font-family:monospace;margin:0"><strong>E-Mail:</strong> ${data.email}<br/><strong>Passwort:</strong> ${data.password}</p>
        </div>
        <div style="text-align:center;margin:32px 0">
          <a href="${loginUrl}" style="background:#0d9488;border-radius:8px;color:#fff;display:inline-block;font-size:16px;font-weight:bold;line-height:50px;text-decoration:none;padding:0 32px">Jetzt anmelden</a>
        </div>`;
    } else {
      credentialsHtml = `<p style="color:#374151;font-size:16px"><strong>E-Mail:</strong> ${data.email}</p>`;
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0">
      <div style="max-width:600px;margin:0 auto;padding:20px 0 48px">
        <h1 style="color:#0d9488;font-size:28px;font-weight:bold;text-align:center;margin:40px 0">PLI Lernportal</h1>
        <p style="color:#1f2937;font-size:16px">Hallo ${data.fullName},</p>
        <p style="color:#374151;font-size:16px">${roleGreeting}</p>
        ${credentialsHtml}
        ${coursesHtml}
        <p style="color:#6b7280;font-size:14px;text-align:center;margin:24px 0">Sollten Sie Fragen haben, wenden Sie sich gerne an Marianne Flury.</p>
        <p style="color:#6b7280;font-size:14px;text-align:center;margin:32px 0 0">Mit freundlichen Grüßen<br/>Ihr Team der Praxis für Lösungs-Impulse</p>
      </div>
    </body></html>`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: [data.email],
      subject: getWelcomeSubject(data.role),
      html,
    });

    console.log(`✅ Welcome email sent to ${data.email} (${data.role})`);
  } catch (error) {
    console.error(`❌ Failed to send welcome email to ${data.email}:`, error);
    // Don't throw - email failures shouldn't block user creation
  }
}

/**
 * Sends password reset email
 */
export async function sendPasswordResetEmail(data: PasswordResetEmailData): Promise<void> {
  try {
    const loginUrl = data.loginUrl || "https://portal.loesungs-impulse.ch/login";
    
    await resend.emails.send({
      from: FROM_EMAIL,
      to: [data.email],
      subject: "Ihr Passwort wurde zurückgesetzt",
      react: PasswordResetEmail({
        fullName: data.fullName,
        email: data.email,
        newPassword: data.newPassword,
        loginUrl,
      }),
    });

    console.log(`✅ Password reset email sent to ${data.email}`);
  } catch (error) {
    console.error(`❌ Failed to send password reset email to ${data.email}:`, error);
    // Don't throw - email failures shouldn't block password reset
  }
}

/**
 * Sends access expired email
 */
export async function sendAccessExpiredEmail(data: AccessExpiredEmailData): Promise<void> {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: [data.email],
      subject: "Ihr Zugang ist abgelaufen",
      react: AccessExpiredEmail({
        fullName: data.fullName,
        email: data.email,
        expiredCourses: data.expiredCourses || [],
      }),
    });

    console.log(`✅ Access expired email sent to ${data.email}`);
  } catch (error) {
    console.error(`❌ Failed to send access expired email to ${data.email}:`, error);
    // Don't throw - email failures shouldn't block access checks
  }
}

/**
 * Gets appropriate welcome email subject based on role
 */
function getWelcomeSubject(role: string): string {
  switch (role) {
    case "admin":
      return "Ihr Admin-Zugang wurde eingerichtet";
    case "dozent":
      return "Sie wurden als Dozent freigeschaltet";
    case "participant":
    default:
      return "Willkommen im Lernportal der Praxis für Lösungs-Impulse";
  }
}
// ─── New Reflexion Notification ───

export interface NewReflexionNotificationData {
  recipientEmail: string;
  recipientName: string;
  studentName: string;
  assignmentTitle: string;
  courseName: string;
  submissionUrl: string;
}

export async function sendNewReflexionNotification(data: NewReflexionNotificationData): Promise<void> {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.recipientEmail,
      subject: `Neue Reflexion von ${data.studentName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
          <div style="text-align: center; margin-bottom: 32px;">
            <img src="https://portal.loesungs-impulse.ch/logo-teal.svg" alt="PLI" style="height: 40px;" />
          </div>
          <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Neue Reflexion eingereicht</h2>
          <p style="color: #666; font-size: 14px; margin-bottom: 24px;">
            Hallo ${data.recipientName},
          </p>
          <div style="background: #f4fafa; border-left: 4px solid #0099A8; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 4px; font-size: 14px;"><strong>${data.studentName}</strong> hat eine Reflexion eingereicht:</p>
            <p style="margin: 0; font-size: 14px; color: #666;">${data.assignmentTitle}</p>
            <p style="margin: 4px 0 0; font-size: 13px; color: #999;">${data.courseName}</p>
          </div>
          <a href="${data.submissionUrl}" style="display: inline-block; background: #0099A8; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;">
            Reflexion ansehen
          </a>
          <p style="color: #999; font-size: 12px; margin-top: 32px;">
            Diese E-Mail wurde automatisch vom PLI Lernportal versendet.
          </p>
        </body>
        </html>
      `,
    });
    console.log(`✅ Reflexion notification sent to ${data.recipientEmail}`);
  } catch (error) {
    console.error(`❌ Failed to send reflexion notification to ${data.recipientEmail}:`, error);
  }
}
