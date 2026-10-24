<?php
function portalMailer(string $root,?array $override=null): \PHPMailer\PHPMailer\PHPMailer {
 require_once __DIR__.'/vendor/phpmailer/Exception.php';require_once __DIR__.'/vendor/phpmailer/PHPMailer.php';require_once __DIR__.'/vendor/phpmailer/SMTP.php';
 $config=$override??(is_file($root.'/smtp.json')?json_decode(file_get_contents($root.'/smtp.json'),true):null);
 if(!is_array($config)||empty($config['password']))throw new RuntimeException('SMTP is not configured.');
 $mail=new \PHPMailer\PHPMailer\PHPMailer(true);$mail->isSMTP();$mail->Host='mail.example.com';$mail->Port=465;$mail->SMTPSecure=\PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;$mail->SMTPAuth=true;$mail->Username='noreply@example.com';$mail->Password=$config['password'];$mail->Timeout=15;$mail->SMTPDebug=0;$mail->CharSet='UTF-8';$mail->setFrom('noreply@example.com','RecycleProof');return $mail;
}
function sendPortalEmail(string $root,string $to,string $subject,string $body): bool {try{$mail=portalMailer($root);$mail->addAddress($to);$mail->Subject=$subject;$mail->Body=$body;return $mail->send();}catch(Throwable $e){error_log('RecycleProof SMTP delivery failed; check owner email settings.');return false;}}
