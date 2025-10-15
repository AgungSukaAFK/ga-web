"use client";

import { Content } from "@/components/content";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function DokumentasiPage() {
  const nama = "Agung Maulana";
  async function notifyUser() {
    try {
      const res = await fetch("/api/v1/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "wismaagung23@gmail.com",
          subject: "Test email",
          html: `<!DOCTYPE html>
<html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">

<head>
	<title></title>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0"><!--[if mso]>
<xml><w:WordDocument xmlns:w="urn:schemas-microsoft-com:office:word"><w:DontUseAdvancedTypographyReadingMail/></w:WordDocument>
<o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch><o:AllowPNG/></o:OfficeDocumentSettings></xml>
<![endif]--><!--[if !mso]><!--><!--<![endif]-->
	<style>
		* {
			box-sizing: border-box;
		}

		body {
			margin: 0;
			padding: 0;
		}

		a[x-apple-data-detectors] {
			color: inherit !important;
			text-decoration: inherit !important;
		}

		#MessageViewBody a {
			color: inherit;
			text-decoration: none;
		}

		p {
			line-height: inherit
		}

		.desktop_hide,
		.desktop_hide table {
			mso-hide: all;
			display: none;
			max-height: 0px;
			overflow: hidden;
		}

		.image_block img+div {
			display: none;
		}

		sup,
		sub {
			font-size: 75%;
			line-height: 0;
		}

		@media (max-width:670px) {

			.desktop_hide table.icons-inner,
			.social_block.desktop_hide .social-table {
				display: inline-block !important;
			}

			.icons-inner {
				text-align: center;
			}

			.icons-inner td {
				margin: 0 auto;
			}

			.mobile_hide {
				display: none;
			}

			.row-content {
				width: 100% !important;
			}

			.stack .column {
				width: 100%;
				display: block;
			}

			.mobile_hide {
				min-height: 0;
				max-height: 0;
				max-width: 0;
				overflow: hidden;
				font-size: 0px;
			}

			.desktop_hide,
			.desktop_hide table {
				display: table !important;
				max-height: none !important;
			}

			.row-7 .column-2 .block-1.paragraph_block td.pad>div {
				font-size: 16px !important;
			}
		}
	</style><!--[if mso ]><style>sup, sub { font-size: 100% !important; } sup { mso-text-raise:10% } sub { mso-text-raise:-10% }</style> <![endif]-->
</head>

<body class="body" style="background-color: #F5F5F5; margin: 0; padding: 0; -webkit-text-size-adjust: none; text-size-adjust: none;">
	<table class="nl-container" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #F5F5F5;">
		<tbody>
			<tr>
				<td>
					<table class="row row-1" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-image: url('https://d1oco4z2z1fhwp.cloudfront.net/templates/default/671/bg_top.jpg'); background-position: top center; background-repeat: repeat;">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; color: #000000; width: 650px; margin: 0 auto;" width="650">
										<tbody>
											<tr>
												<td class="column column-1" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 5px; padding-top: 5px; vertical-align: top;">
													<div class="spacer_block block-1" style="height:51px;line-height:51px;font-size:1px;">&#8202;</div>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					<table class="row row-2" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; color: #000000; width: 650px; margin: 0 auto;" width="650">
										<tbody>
											<tr>
												<td class="column column-1" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 5px; padding-left: 15px; padding-right: 15px; padding-top: 5px; vertical-align: top;">
													<table class="image_block block-1" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad" style="padding-left:10px;padding-right:15px;width:100%;">
																<div class="alignment" align="left">
																	<div style="max-width: 130px;"><img src="https://d1oco4z2z1fhwp.cloudfront.net/templates/default/671/logosh.gif" style="display: block; height: auto; border: 0; width: 100%;" width="130" alt="Social Hug Logo" title="Social Hug Logo" height="auto"></div>
																</div>
															</td>
														</tr>
													</table>
													<div class="spacer_block block-2" style="height:30px;line-height:30px;font-size:1px;">&#8202;</div>
													<table class="paragraph_block block-3" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;">
														<tr>
															<td class="pad" style="padding-bottom:10px;padding-left:10px;padding-right:10px;">
																<div style="color:#1a6eff;font-family:Tahoma, Verdana, Segoe, sans-serif;font-size:42px;line-height:1.2;text-align:left;mso-line-height-alt:50px;">
																	<p style="margin: 0; word-break: break-word;"><strong><span style="word-break: break-word;">Hello ${nama},</span></strong></p>
																</div>
															</td>
														</tr>
													</table>
													<table class="paragraph_block block-4" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;">
														<tr>
															<td class="pad" style="padding-bottom:30px;padding-left:10px;padding-right:10px;">
																<div style="color:#555555;font-family:Tahoma, Verdana, Segoe, sans-serif;font-size:22px;line-height:1.2;text-align:left;mso-line-height-alt:26px;">
																	<p style="margin: 0;">Selamat datang di GarudaProcure!!!</p>
																</div>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					<table class="row row-3" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #FFFFFF; color: #000000; width: 650px; margin: 0 auto;" width="650">
										<tbody>
											<tr>
												<td class="column column-1" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-top: 5px; vertical-align: top;">
													<div class="spacer_block block-1" style="height:20px;line-height:20px;font-size:1px;">&#8202;</div>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					<table class="row row-4" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #FFFFFF; color: #333; width: 650px; margin: 0 auto;" width="650">
										<tbody>
											<tr>
												<td class="column column-1" width="25%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 25px; padding-left: 25px; padding-right: 25px; padding-top: 25px; vertical-align: top;">
													<table class="image_block block-1" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad" style="width:100%;padding-right:0px;padding-left:0px;">
																<div class="alignment" align="center">
																	<div style="max-width: 79.1px;"><a href="#" target="_blank"><img src="https://d1oco4z2z1fhwp.cloudfront.net/templates/default/671/1.png" style="display: block; height: auto; border: 0; width: 100%;" width="79.1" alt="Bleah" title="Bleah" height="auto"></a></div>
																</div>
															</td>
														</tr>
													</table>
													<table class="paragraph_block block-2" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;">
														<tr>
															<td class="pad">
																<div style="color:#555555;font-family:Tahoma, Verdana, Segoe, sans-serif;font-size:14px;line-height:1.2;text-align:center;mso-line-height-alt:17px;">
																	<p style="margin: 0; word-break: break-word;"><strong>Bleah</strong></p>
																</div>
															</td>
														</tr>
													</table>
												</td>
												<td class="column column-2" width="25%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 25px; padding-left: 25px; padding-right: 25px; padding-top: 25px; vertical-align: top;">
													<table class="image_block block-1" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad" style="width:100%;padding-right:0px;padding-left:0px;">
																<div class="alignment" align="center">
																	<div style="max-width: 79.1px;"><a href="#" target="_blank"><img src="https://d1oco4z2z1fhwp.cloudfront.net/templates/default/671/2.png" style="display: block; height: auto; border: 0; width: 100%;" width="79.1" alt="Sigh" title="Sigh" height="auto"></a></div>
																</div>
															</td>
														</tr>
													</table>
													<table class="paragraph_block block-2" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;">
														<tr>
															<td class="pad">
																<div style="color:#555555;font-family:Tahoma, Verdana, Segoe, sans-serif;font-size:14px;line-height:1.2;text-align:center;mso-line-height-alt:17px;">
																	<p style="margin: 0; word-break: break-word;"><strong>Sigh</strong></p>
																</div>
															</td>
														</tr>
													</table>
												</td>
												<td class="column column-3" width="25%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 25px; padding-left: 25px; padding-right: 25px; padding-top: 25px; vertical-align: top;">
													<table class="image_block block-1" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad" style="width:100%;padding-right:0px;padding-left:0px;">
																<div class="alignment" align="center">
																	<div style="max-width: 79.1px;"><a href="#" target="_blank"><img src="https://d1oco4z2z1fhwp.cloudfront.net/templates/default/671/3.png" style="display: block; height: auto; border: 0; width: 100%;" width="79.1" alt="Mmmh" title="Mmmh" height="auto"></a></div>
																</div>
															</td>
														</tr>
													</table>
													<table class="paragraph_block block-2" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;">
														<tr>
															<td class="pad">
																<div style="color:#555555;font-family:Tahoma, Verdana, Segoe, sans-serif;font-size:14px;line-height:1.2;text-align:center;mso-line-height-alt:17px;">
																	<p style="margin: 0; word-break: break-word;"><strong>Mmmh</strong></p>
																</div>
															</td>
														</tr>
													</table>
												</td>
												<td class="column column-4" width="25%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 25px; padding-left: 25px; padding-right: 25px; padding-top: 25px; vertical-align: top;">
													<table class="image_block block-1" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad" style="width:100%;padding-right:0px;padding-left:0px;">
																<div class="alignment" align="center">
																	<div style="max-width: 79.1px;"><a href="#" target="_blank"><img src="https://d1oco4z2z1fhwp.cloudfront.net/templates/default/671/4.png" style="display: block; height: auto; border: 0; width: 100%;" width="79.1" alt="Meh" title="Meh" height="auto"></a></div>
																</div>
															</td>
														</tr>
													</table>
													<table class="paragraph_block block-2" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;">
														<tr>
															<td class="pad">
																<div style="color:#555555;font-family:Tahoma, Verdana, Segoe, sans-serif;font-size:14px;line-height:1.2;text-align:center;mso-line-height-alt:17px;">
																	<p style="margin: 0; word-break: break-word;"><strong>Meh!</strong></p>
																</div>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					<table class="row row-5" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #FFFFFF; color: #333; width: 650px; margin: 0 auto;" width="650">
										<tbody>
											<tr>
												<td class="column column-1" width="25%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 25px; padding-left: 25px; padding-right: 25px; padding-top: 25px; vertical-align: top;">
													<table class="image_block block-1" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad" style="width:100%;padding-right:0px;padding-left:0px;">
																<div class="alignment" align="center">
																	<div style="max-width: 79.1px;"><a href="#" target="_blank"><img src="https://d1oco4z2z1fhwp.cloudfront.net/templates/default/671/5.png" style="display: block; height: auto; border: 0; width: 100%;" width="79.1" alt="Yes" title="Yes" height="auto"></a></div>
																</div>
															</td>
														</tr>
													</table>
													<table class="paragraph_block block-2" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;">
														<tr>
															<td class="pad">
																<div style="color:#555555;font-family:Tahoma, Verdana, Segoe, sans-serif;font-size:14px;line-height:1.2;text-align:center;mso-line-height-alt:17px;">
																	<p style="margin: 0; word-break: break-word;"><strong>Yes</strong></p>
																</div>
															</td>
														</tr>
													</table>
												</td>
												<td class="column column-2" width="25%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 25px; padding-left: 25px; padding-right: 25px; padding-top: 25px; vertical-align: top;">
													<table class="image_block block-1" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad" style="width:100%;padding-right:0px;padding-left:0px;">
																<div class="alignment" align="center">
																	<div style="max-width: 79.1px;"><a href="#" target="_blank"><img src="https://d1oco4z2z1fhwp.cloudfront.net/templates/default/671/6.png" style="display: block; height: auto; border: 0; width: 100%;" width="79.1" alt="I like It" title="I like It" height="auto"></a></div>
																</div>
															</td>
														</tr>
													</table>
													<table class="paragraph_block block-2" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;">
														<tr>
															<td class="pad">
																<div style="color:#555555;font-family:Tahoma, Verdana, Segoe, sans-serif;font-size:14px;line-height:1.2;text-align:center;mso-line-height-alt:17px;">
																	<p style="margin: 0; word-break: break-word;"><strong>I like it</strong></p>
																</div>
															</td>
														</tr>
													</table>
												</td>
												<td class="column column-3" width="25%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 25px; padding-left: 25px; padding-right: 25px; padding-top: 25px; vertical-align: top;">
													<table class="image_block block-1" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad" style="width:100%;padding-right:0px;padding-left:0px;">
																<div class="alignment" align="center">
																	<div style="max-width: 84.75px;"><a href="#" target="_blank"><img src="https://d1oco4z2z1fhwp.cloudfront.net/templates/default/671/7.png" style="display: block; height: auto; border: 0; width: 100%;" width="84.75" alt="Wow" title="Wow" height="auto"></a></div>
																</div>
															</td>
														</tr>
													</table>
													<table class="paragraph_block block-2" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;">
														<tr>
															<td class="pad">
																<div style="color:#555555;font-family:Tahoma, Verdana, Segoe, sans-serif;font-size:14px;line-height:1.2;text-align:center;mso-line-height-alt:17px;">
																	<p style="margin: 0; word-break: break-word;"><strong>Wow</strong></p>
																</div>
															</td>
														</tr>
													</table>
												</td>
												<td class="column column-4" width="25%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 25px; padding-left: 25px; padding-right: 25px; padding-top: 25px; vertical-align: top;">
													<table class="image_block block-1" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad" style="width:100%;padding-right:0px;padding-left:0px;">
																<div class="alignment" align="center">
																	<div style="max-width: 79.1px;"><a href="#" target="_blank"><img src="https://d1oco4z2z1fhwp.cloudfront.net/templates/default/671/8.png" style="display: block; height: auto; border: 0; width: 100%;" width="79.1" alt="I'm in love" title="I'm in love" height="auto"></a></div>
																</div>
															</td>
														</tr>
													</table>
													<table class="paragraph_block block-2" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;">
														<tr>
															<td class="pad">
																<div style="color:#555555;font-family:Tahoma, Verdana, Segoe, sans-serif;font-size:14px;line-height:1.2;text-align:center;mso-line-height-alt:17px;">
																	<p style="margin: 0; word-break: break-word;"><strong>I'm in love</strong></p>
																</div>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					<table class="row row-6" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #FFFFFF; color: #000000; width: 650px; margin: 0 auto;" width="650">
										<tbody>
											<tr>
												<td class="column column-1" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-top: 5px; vertical-align: top;">
													<div class="spacer_block block-1" style="height:20px;line-height:20px;font-size:1px;">&#8202;</div>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					<table class="row row-7" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
						<tbody>
							<tr>
								<td>
									<table class="row-content" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #E4E9ED; color: #333; width: 650px; margin: 0 auto;" width="650">
										<tbody>
											<tr>
												<td class="column column-1" width="25%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; vertical-align: middle;">
													<table class="image_block block-1" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad" style="width:100%;padding-right:0px;padding-left:0px;">
																<div class="alignment" align="center">
																	<div style="max-width: 122.25px;"><img src="https://0cdb28af63.imgdist.com/pub/bfra/bldnc1bz/lhq/5ms/sbt/cat-domestic-animal-animal-gray-3261420.jpg" style="display: block; height: auto; border: 0; width: 100%; border-radius: 100px;" width="122.25" alt="CEO" title="CEO" height="auto"></div>
																</div>
															</td>
														</tr>
													</table>
												</td>
												<td class="column column-2" width="75%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; vertical-align: middle;">
													<table class="paragraph_block block-1" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;">
														<tr>
															<td class="pad" style="padding-bottom:20px;padding-left:10px;padding-right:10px;padding-top:20px;">
																<div style="color:#555555;font-family:Tahoma, Verdana, Segoe, sans-serif;font-size:22px;line-height:1.5;text-align:left;mso-line-height-alt:33px;">
																	<p style="margin: 0;"><span style="word-break: break-word; color: #1a6eff;"><strong>Thank you!</strong></span></p>
																	<p style="margin: 0;">Agung, Programmer Cipocok (ProCipok)</p>
																</div>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					<table class="row row-8" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; color: #000000; width: 650px; margin: 0 auto;" width="650">
										<tbody>
											<tr>
												<td class="column column-1" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 5px; padding-top: 5px; vertical-align: top;">
													<div class="spacer_block block-1" style="height:60px;line-height:60px;font-size:1px;">&#8202;</div>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					<table class="row row-9" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-image: url('https://d1oco4z2z1fhwp.cloudfront.net/templates/default/671/bg_bottom.jpg'); background-position: top center; background-repeat: repeat;">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; color: #000000; width: 650px; margin: 0 auto;" width="650">
										<tbody>
											<tr>
												<td class="column column-1" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 5px; padding-top: 5px; vertical-align: top;">
													<div class="spacer_block block-1" style="height:165px;line-height:165px;font-size:1px;">&#8202;</div>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					<table class="row row-10" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #4D8EFD;">
						<tbody>
							<tr>
								<td>
									<table class="row-content" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; color: #333; width: 650px; margin: 0 auto;" width="650">
										<tbody>
											<tr>
												<td class="column column-1" width="50%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 5px; padding-top: 5px; vertical-align: middle;">
													<table class="paragraph_block block-1" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;">
														<tr>
															<td class="pad">
																<div style="color:#FFFFFF;font-family:Tahoma, Verdana, Segoe, sans-serif;font-size:30px;line-height:1.2;text-align:left;mso-line-height-alt:36px;">
																	<p style="margin: 0; word-break: break-word;"><strong><span style="word-break: break-word;">Stay in touch!</span></strong></p>
																</div>
															</td>
														</tr>
													</table>
												</td>
												<td class="column column-2" width="50%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 5px; padding-top: 5px; vertical-align: middle;">
													<table class="social_block block-1" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
														<tr>
															<td class="pad">
																<div class="alignment" align="center">
																	<table class="social-table" width="126px" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; display: inline-block;">
																		<tr>
																			<td style="padding:0 5px 0 5px;"><a href="https://www.twitter.com" target="_blank"><img src="https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/t-outline-circle-white/twitter@2x.png" width="32" height="auto" alt="Twitter" title="Twitter" style="display: block; height: auto; border: 0;"></a></td>
																			<td style="padding:0 5px 0 5px;"><a href="https://www.instagram.com" target="_blank"><img src="https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/t-outline-circle-white/instagram@2x.png" width="32" height="auto" alt="Instagram" title="Instagram" style="display: block; height: auto; border: 0;"></a></td>
																			<td style="padding:0 5px 0 5px;"><a href="https://www.linkedin.com" target="_blank"><img src="https://app-rsrc.getbee.io/public/resources/social-networks-icon-sets/t-outline-circle-white/linkedin@2x.png" width="32" height="auto" alt="LinkedIn" title="LinkedIn" style="display: block; height: auto; border: 0;"></a></td>
																		</tr>
																	</table>
																</div>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					<table class="row row-11" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #2575FF;">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; color: #000000; width: 650px; margin: 0 auto;" width="650">
										<tbody>
											<tr>
												<td class="column column-1" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 30px; padding-top: 30px; vertical-align: top;">
													<table class="paragraph_block block-1" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; word-break: break-word;">
														<tr>
															<td class="pad">
																<div style="color:#FFFFFF;font-family:Tahoma, Verdana, Segoe, sans-serif;font-size:14px;line-height:1.2;text-align:left;mso-line-height-alt:17px;">
																	<p style="margin: 0; word-break: break-word;"><em>Connect with friends and the world around you on SocialHug.</em></p>
																	<p style="margin: 0; word-break: break-word;"><strong>123 Love Road,&nbsp;CA 94107 San Francisco /&nbsp;</strong>SocialHug 2019 © all rights reserved</p>
																</div>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
					<table class="row row-12" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #ffffff;">
						<tbody>
							<tr>
								<td>
									<table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #ffffff; color: #000000; width: 650px; margin: 0 auto;" width="650">
										<tbody>
											<tr>
												<td class="column column-1" width="100%" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; font-weight: 400; text-align: left; padding-bottom: 5px; padding-top: 5px; vertical-align: top;">
													<table class="icons_block block-1" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; text-align: center; line-height: 0;">
														<tr>
															<td class="pad" style="vertical-align: middle; color: #1e0e4b; font-family: 'Inter', sans-serif; font-size: 15px; padding-bottom: 5px; padding-top: 5px; text-align: center;"><!--[if vml]><table align="center" cellpadding="0" cellspacing="0" role="presentation" style="display:inline-block;padding-left:0px;padding-right:0px;mso-table-lspace: 0pt;mso-table-rspace: 0pt;"><![endif]-->
																<!--[if !vml]><!-->
																<table class="icons-inner" style="mso-table-lspace: 0pt; mso-table-rspace: 0pt; display: inline-block; padding-left: 0px; padding-right: 0px;" cellpadding="0" cellspacing="0" role="presentation"><!--<![endif]-->
																	<tr>
																		<td style="vertical-align: middle; text-align: center; padding-top: 5px; padding-bottom: 5px; padding-left: 5px; padding-right: 6px;"><a href="https://designedwithbeefree.com/" target="_blank" style="text-decoration: none;"><img class="icon" alt="Beefree Logo" src="https://d1oco4z2z1fhwp.cloudfront.net/assets/Beefree-logo.png" height="auto" width="34" align="center" style="display: block; height: auto; margin: 0 auto; border: 0;"></a></td>
																		<td style="font-family: 'Inter', sans-serif; font-size: 15px; font-weight: undefined; color: #1e0e4b; vertical-align: middle; letter-spacing: undefined; text-align: center; line-height: normal;"><a href="https://designedwithbeefree.com/" target="_blank" style="color: #1e0e4b; text-decoration: none;">Designed with Beefree</a></td>
																	</tr>
																</table>
															</td>
														</tr>
													</table>
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
				</td>
			</tr>
		</tbody>
	</table><!-- End -->
</body>

</html>`,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("✅ Email sent successfully!");
        console.log("Message ID:", data.messageId);
      } else {
        toast.error("❌ Failed to send email: " + data.error);
        console.error("Email sending error:", data.error);
      }
    } catch (err: any) {
      console.error("Unexpected error:", err);
      toast.error("Something went wrong: " + err.message);
    }
  }

  return (
    <Content>
      <Button onClick={notifyUser}>Click Me</Button>
    </Content>
  );
}
