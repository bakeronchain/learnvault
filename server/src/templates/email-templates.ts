export type EmailVariables = Record<string, string>

const baseLayout = (content: string, vars: EmailVariables) => `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; }
        .header { text-align: center; margin-bottom: 20px; }
        .footer { margin-top: 30px; font-size: 12px; color: #777; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
        .button { display: inline-block; padding: 12px 24px; color: white !important; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 0; }
        .primary { background-color: #4f46e5; }
        .success { background-color: #10b981; }
        .danger { background-color: #ef4444; }
        .warning { background-color: #f59e0b; }
        .info { background-color: #3b82f6; }
        .accent { background-color: #8b5cf6; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="color: #4f46e5; margin: 0;">LearnVault</h1>
        </div>
        ${content}
        <div class="footer">
            <p>You received this email because you registered on LearnVault.</p>
            <p><a href="${vars.unsubscribeUrl || "#"}" style="color: #777;">Unsubscribe</a></p>
        </div>
    </div>
</body>
</html>
`

export const templates: Record<string, (vars: EmailVariables) => string> = {
  "proposal-submitted": (vars) =>
    baseLayout(
      `
    <p>Hi ${vars.name},</p>
    <p>Great news! Your scholarship proposal <strong>${vars.proposalTitle}</strong> is now live on LearnVault.</p>
    <p>Donors can now see your proposal and start voting.</p>
    <p><a href="${vars.proposalUrl}" class="button primary">View Proposal</a></p>
    <p>Best,<br>The LearnVault Team</p>
  `,
      vars,
    ),

  "proposal-approved": (vars) =>
    baseLayout(
      `
    <p>Hi ${vars.name},</p>
    <p>🎉 Your scholarship proposal <strong>${vars.proposalTitle}</strong> was approved!</p>
    <p>Congratulations, you can now start your learning journey and submit milestones.</p>
    <p><a href="${vars.proposalUrl}" class="button success">Go to Dashboard</a></p>
    <p>Best,<br>The LearnVault Team</p>
  `,
      vars,
    ),

  "proposal-rejected": (vars) =>
    baseLayout(
      `
    <p>Hi ${vars.name},</p>
    <p>Unfortunately, your scholarship proposal <strong>${vars.proposalTitle}</strong> was not approved in its current form.</p>
    <p><strong>Reason:</strong> ${vars.rejectionReason}</p>
    <p>You can revise and resubmit your proposal.</p>
    <p><a href="${vars.proposalUrl}" class="button danger">Revise Proposal</a></p>
    <p>Best,<br>The LearnVault Team</p>
  `,
      vars,
    ),

  "milestone-verified": (vars) =>
    baseLayout(
      `
    <p>Hi ${vars.name},</p>
    <p><strong>Milestone verified — funds released!</strong></p>
    <p>Your milestone <strong>${vars.milestoneTitle}</strong> for the course <strong>${vars.courseTitle}</strong> has been verified by the validator.</p>
    <p>The scholarship funds have been released to your wallet.</p>
    <p><a href="${vars.dashboardUrl}" class="button info">View Dashboard</a></p>
    <p>Keep up the great work!</p>
    <p>Best,<br>The LearnVault Team</p>
  `,
      vars,
    ),

  "milestone-rejected": (vars) =>
    baseLayout(
      `
    <p>Hi ${vars.name},</p>
    <p><strong>Your milestone report needs more evidence.</strong></p>
    <p>Your report for <strong>${vars.milestoneTitle}</strong> was rejected by the validator.</p>
    <p><strong>Reason:</strong> ${vars.rejectionReason}</p>
    <p>Please update your report with more evidence to get it verified.</p>
    <p><a href="${vars.milestoneUrl}" class="button warning">Update Milestone</a></p>
    <p>Best,<br>The LearnVault Team</p>
  `,
      vars,
    ),

  "inactivity-reminder": (vars) =>
    baseLayout(
      `
    <p>Hi ${vars.name},</p>
    <p><strong>Action needed — update your milestone.</strong></p>
    <p>Your scholarship milestone <strong>${vars.milestoneTitle}</strong> is approaching the inactivity timeout.</p>
    <p>Please submit your progress or update the milestone within the next 7 days to avoid losing your scholarship.</p>
    <p><a href="${vars.milestoneUrl}" class="button warning" style="background-color: #f97316;">Submit Milestone</a></p>
    <p>Best,<br>The LearnVault Team</p>
  `,
      vars,
    ),

	"certificate-awarded": (vars) =>
		baseLayout(
			`
    <p>Hi ${vars.name},</p>
    <p><strong>Congratulations — you earned a certificate!</strong></p>
    <p>You have completed all milestones in <strong>${vars.courseTitle}</strong> and a ScholarNFT credential has been minted to your wallet.</p>
    <p>This soulbound token is your permanent on-chain proof of completion.</p>
    <p><a href="${vars.certificateUrl}" class="button success">View Certificate</a></p>
    <p>Keep building!</p>
    <p>Best,<br>The LearnVault Team</p>
  `,
			vars,
		),

	"voted-on-proposal": (vars) =>
		baseLayout(
			`
    <p>Hi ${vars.name},</p>
    <p><strong>You voted on ${vars.proposalTitle}!</strong></p>
    <p>Thank you for supporting this scholar. Your vote helps empower the next generation of builders on Stellar.</p>
    <p><a href="${vars.proposalUrl}" class="button accent">View Proposal</a></p>
    <p>Best,<br>The LearnVault Team</p>
  `,
      vars,
    ),

  "admin-alert": (vars) =>
    baseLayout(
      `
    <p><strong>Attention Admin,</strong></p>
    <p>A new milestone submission requires review.</p>
    <hr />
    <p>${vars.body}</p>
    <p><a href="${vars.adminUrl || '#'}" class="button accent">Review in Admin Panel</a></p>
    <p>Best,<br>LearnVault System</p>
  `,
      vars,
    ),
}

/**
 * Basic helper to strip HTML and provide a plain-text fallback.
 */
export const toPlainText = (html: string): string => {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
