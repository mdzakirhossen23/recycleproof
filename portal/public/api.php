<?php
declare(strict_types=1);
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
session_name('recycleproof_portal');
session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS']!=='off','httponly'=>true,'samesite'=>'Strict']);
ini_set('session.use_strict_mode','1');
session_start();
$_SESSION['csrf'] ??= bin2hex(random_bytes(32));
function respond(array $data, int $status=200): never {http_response_code($status);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
function fail(string $text,int $status=400): never {respond(['error'=>$text],$status);}
function field(array $input,string $key,int $max=150): string {$value=trim((string)($input[$key]??''));if($value==='' || strlen($value)>$max)fail('Please complete '.$key.' with a valid value.');return $value;}
function cleanUser(array $u): array {unset($u['password'],$u['session_version']);return $u;}
function run(PDO $db,string $sql,array $args=[]): PDOStatement {$stmt=$db->prepare($sql);$stmt->execute($args);return $stmt;}
function visible(array $user,array $batch): bool {return $user['role']==='controller'||(int)$batch['collector_id']===(int)$user['id']||(int)$batch['recycler_id']===(int)$user['id'];}
function who(PDO $db): array {if(empty($_SESSION['uid']))fail('Sign in to continue.',401);$u=run($db,'SELECT * FROM users WHERE id=?',[$_SESSION['uid']])->fetch();if(!$u||(int)($_SESSION['version']??0)!==(int)$u['session_version'])fail('Sign in again.',401);if($u['status']!=='active')fail('Your account needs controller approval.',403);return $u;}
function throttle(PDO $db,string $bucket,int $limit=12): void {$key=hash('sha256',($_SERVER['REMOTE_ADDR']??'local').'|'.$bucket);$since=time()-900;run($db,'DELETE FROM attempts WHERE created_at < ?',[$since]);$count=(int)run($db,'SELECT COUNT(*) FROM attempts WHERE bucket=? AND created_at>=?',[$key,$since])->fetchColumn();if($count>=$limit)fail('Too many attempts. Please wait 15 minutes.',429);run($db,'INSERT INTO attempts(bucket,created_at) VALUES(?,?)',[$key,time()]);}
function audit(PDO $db,int $uid,string $action,string $ref): void {run($db,'INSERT INTO audit(user_id,action,reference,created_at) VALUES(?,?,?,?)',[$uid,$action,$ref,gmdate('c')]);}
try {
 if(!in_array('sqlite',PDO::getAvailableDrivers(),true))fail('The hosting PHP configuration needs PDO SQLite enabled before account setup.',503);
 $root=dirname(__DIR__,2).'/private/recycleproof';
 if(!is_dir($root)&&!mkdir($root,0700,true))throw new RuntimeException('Cannot create private data directory');
 $db=new PDO('sqlite:'.$root.'/portal.sqlite',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
 $db->exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
 $db->exec('CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE COLLATE NOCASE,organization TEXT NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ("controller","collector","recycler")),status TEXT NOT NULL CHECK(status IN ("active","pending","suspended")),created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS batches(id INTEGER PRIMARY KEY AUTOINCREMENT,reference TEXT NOT NULL UNIQUE COLLATE NOCASE,material TEXT NOT NULL,weight REAL NOT NULL,collector_id INTEGER NOT NULL REFERENCES users(id),recycler_id INTEGER NOT NULL REFERENCES users(id),location TEXT NOT NULL,notes TEXT NOT NULL,photo TEXT,status TEXT NOT NULL CHECK(status IN ("collected","received","flagged")),created_at TEXT NOT NULL,received_at TEXT,receipt TEXT,collection_hash TEXT NOT NULL,receipt_hash TEXT);
 CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,action TEXT NOT NULL,reference TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS attempts(id INTEGER PRIMARY KEY AUTOINCREMENT,bucket TEXT NOT NULL,created_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS attempts_lookup ON attempts(bucket,created_at);');
 $columns=$db->query('PRAGMA table_info(users)')->fetchAll();if(!in_array('session_version',array_column($columns,'name'),true))$db->exec('ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0');
 $columns=$db->query('PRAGMA table_info(users)')->fetchAll();if(!in_array('archived',array_column($columns,'name'),true))$db->exec('ALTER TABLE users ADD COLUMN archived INTEGER NOT NULL DEFAULT 0');
 $db->exec('CREATE TABLE IF NOT EXISTS password_resets(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL)');
 @chmod($root.'/portal.sqlite',0600);
 $action=(string)($_GET['action']??'me');
 $controllerExists=(bool)$db->query('SELECT 1 FROM users WHERE role="controller" LIMIT 1')->fetchColumn();
 if($action==='me'){$u=empty($_SESSION['uid'])?null:run($db,'SELECT * FROM users WHERE id=?',[$_SESSION['uid']])->fetch();respond(['user'=>$u&&(int)($_SESSION['version']??0)===(int)$u['session_version']?cleanUser($u):null,'csrf'=>$_SESSION['csrf'],'setup_ready'=>!$controllerExists]);}
 if($_SERVER['REQUEST_METHOD']==='POST') {
  $sent=(string)($_SERVER['HTTP_X_CSRF_TOKEN']??'');if(!hash_equals($_SESSION['csrf'],$sent))fail('Session expired. Reload the page and try again.',403);
  $length=(int)($_SERVER['CONTENT_LENGTH']??0);if($length>4*1024*1024)fail('Upload is too large.',413);
  $input=str_contains($_SERVER['CONTENT_TYPE']??'','application/json')?json_decode(file_get_contents('php://input'),true):$_POST;
  if(!is_array($input))fail('Invalid request.');
 }else $input=[];
 $writes=['rebuild_check','rebuild_accounts','smtp_save','smtp_test','forgot_password','reset_password','reset_check','setup','signup','login','logout','create_batch','receive','flag','user_status'];
 if(in_array($action,$writes,true)&&$_SERVER['REQUEST_METHOD']!=='POST')fail('POST required.',405);


 if($action==='rebuild_check'||$action==='rebuild_accounts'){
  throttle($db,'account_rebuild',8);$file=__DIR__.'/account-rebuild-config.php';if(!is_file($file))fail('This account replacement link is no longer available.',403);$config=require $file;$token=(string)($input['token']??'');if(time()>$config['expires']||!hash_equals($config['hash'],hash('sha256',$token)))fail('This private replacement link is invalid or expired.',403);
  if($action==='rebuild_check')respond(['ok'=>true]);
  if(($input['confirmation']??'')!=='REPLACE')fail('Confirm replacement before continuing.');$password=(string)($input['password']??'');if(strlen($password)<6||strlen($password)>72)fail('Use a password between 6 and 72 bytes.');$passwordHash=password_hash($password,PASSWORD_DEFAULT);
  $db->beginTransaction();if($db->query('SELECT 1 FROM audit WHERE action="account_rebuild_'.substr($config['hash'],0,16).'" LIMIT 1')->fetchColumn()){$db->rollBack();fail('This replacement link was already used.',409);}
  run($db,'UPDATE users SET email=("archived-" || id || "-" || ? || "@disabled.invalid"),status="suspended",archived=1,password="!",session_version=session_version+1 WHERE archived=0',[time()]);run($db,'DELETE FROM password_resets');
  foreach([['Zakir','controller@example.com','controller'],['Bahar','collector@example.com','collector'],['Rahim','recycler@example.com','recycler']] as $account){run($db,'INSERT INTO users(name,email,organization,password,role,status,created_at) VALUES(?,?,?,?,?,"active",?)',[$account[0],$account[1],'RecycleProof',$passwordHash,$account[2],gmdate('c')]);}
  audit($db,0,'account_rebuild_'.substr($config['hash'],0,16),'Three approved replacement accounts; historical records retained');$db->commit();@unlink($file);$_SESSION=[];session_regenerate_id(true);$_SESSION['csrf']=bin2hex(random_bytes(32));respond(['ok'=>true]);
 }
 require_once __DIR__.'/mailer.php';
 if($action==='forgot_password'){
  if(!is_file($root.'/smtp.json'))fail('Password reset email is not configured yet. Ask the controller to configure Email settings.',503);
  throttle($db,'forgot_password',5);$email=strtolower(field($input,'email',180));if(!filter_var($email,FILTER_VALIDATE_EMAIL))fail('Enter a valid email address.');
  $target=run($db,'SELECT id,email FROM users WHERE email=?',[$email])->fetch();
  if($target){$now=time();$recent=run($db,'SELECT 1 FROM password_resets WHERE user_id=? AND expires_at>?',[$target['id'],$now+840])->fetch();if(!$recent){$token=bin2hex(random_bytes(32));$hash=hash('sha256',$token);run($db,'DELETE FROM password_resets WHERE user_id=? OR expires_at<?',[$target['id'],$now]);run($db,'INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES(?,?,?)',[$hash,$target['id'],$now+900]);$link='https://recycle.baharsoftbd.com/reset.html#token='.$token;$body="A password reset was requested for your RecycleProof account.\n\nOpen this private link within 15 minutes:\n".$link."\n\nUse it once to set your own password. If you did not request this, ignore this email. Never share this link or your wallet recovery phrase.";$sent=sendPortalEmail($root,$target['email'],'Reset your RecycleProof password',$body);if(!$sent){run($db,'DELETE FROM password_resets WHERE token_hash=?',[$hash]);error_log('RecycleProof password reset email could not be sent.');}}}
  respond(['ok'=>true,'message'=>'If that email is registered, a reset link will arrive. Check spam. The link expires in 15 minutes.']);
 }
 if($action==='reset_check'||$action==='reset_password'){
  throttle($db,'reset_password',12);$token=(string)($input['token']??'');if(!preg_match('/^[a-f0-9]{64}$/',$token))fail('This reset link is invalid or expired. Request a new link.');$hash=hash('sha256',$token);$reset=run($db,'SELECT * FROM password_resets WHERE token_hash=? AND expires_at>?',[$hash,time()])->fetch();if(!$reset)fail('This reset link is invalid or expired. Request a new link.');if($action==='reset_check')respond(['ok'=>true]);
  $password=(string)($input['password']??'');if(strlen($password)<6||strlen($password)>72)fail('Use a password between 6 and 72 bytes.');
  $db->beginTransaction();$claim=run($db,'DELETE FROM password_resets WHERE token_hash=? AND expires_at>?',[$hash,time()]);if($claim->rowCount()!==1){$db->rollBack();fail('This reset link is invalid or expired. Request a new link.');}run($db,'UPDATE users SET password=?,session_version=session_version+1 WHERE id=?',[password_hash($password,PASSWORD_DEFAULT),$reset['user_id']]);run($db,'DELETE FROM password_resets WHERE user_id=?',[$reset['user_id']]);audit($db,(int)$reset['user_id'],'password_reset','email-link');$db->commit();unset($_SESSION['uid'],$_SESSION['version']);session_regenerate_id(true);$_SESSION['csrf']=bin2hex(random_bytes(32));respond(['ok'=>true]);
 }
 if($action==='logout'){$_SESSION=[];session_regenerate_id(true);$_SESSION['csrf']=bin2hex(random_bytes(32));respond(['ok'=>true,'csrf'=>$_SESSION['csrf']]);}
 if($action==='setup'||$action==='signup') {
  throttle($db,$action,8);
  if($action==='setup'){
   if($controllerExists)fail('Workspace is already configured.',409);
   $configFile=__DIR__.'/owner-config.php';if(!is_file($configFile))fail('Owner setup has not been enabled.',503);
   $config=require $configFile;
   if(!hash_equals($config['setup_hash'],hash('sha256',(string)($input['setup_key']??''))))fail('Invalid owner setup key.',403);
  }
  $name=field($input,'name',100);$org=field($input,'organization',100);$email=strtolower(field($input,'email',180));
  if(!filter_var($email,FILTER_VALIDATE_EMAIL))fail('Enter a valid email address.');
  $password=(string)($input['password']??'');if(strlen($password)<6||strlen($password)>72)fail('Use a password between 6 and 72 bytes.');
  $role=$action==='setup'?'controller':(string)($input['role']??'');if(!in_array($role,['controller','collector','recycler'],true)||($action==='signup'&&$role==='controller'))fail('Invalid role.');
  $db->beginTransaction();
  if($action==='setup'&&$db->query('SELECT 1 FROM users WHERE role="controller" LIMIT 1')->fetchColumn()){$db->rollBack();fail('Workspace is already configured.',409);}
  if(run($db,'SELECT id FROM users WHERE email=?',[$email])->fetch()){$db->rollBack();fail('This email is already registered.',409);}
  run($db,'INSERT INTO users(name,email,organization,password,role,status,created_at) VALUES(?,?,?,?,?,?,?)',[$name,$email,$org,password_hash($password,PASSWORD_DEFAULT),$role,$action==='setup'?'active':'pending',gmdate('c')]);
  $id=(int)$db->lastInsertId();audit($db,$id,$action,$email);$db->commit();
  if($action==='setup'){session_regenerate_id(true);$_SESSION['uid']=$id;$_SESSION['csrf']=bin2hex(random_bytes(32));$u=run($db,'SELECT * FROM users WHERE id=?',[$id])->fetch();respond(['user'=>cleanUser($u),'csrf'=>$_SESSION['csrf']]);}
  respond(['ok'=>true]);
 }
 if($action==='login'){
  throttle($db,'login',15);$email=strtolower(field($input,'email',180));$u=run($db,'SELECT * FROM users WHERE email=?',[$email])->fetch();
  if(!$u||!password_verify((string)($input['password']??''),$u['password']))fail('Email or password is incorrect.',401);
  session_regenerate_id(true);$_SESSION['uid']=$u['id'];$_SESSION['version']=(int)$u['session_version'];$_SESSION['csrf']=bin2hex(random_bytes(32));respond(['user'=>cleanUser($u),'csrf'=>$_SESSION['csrf']]);
 }
 $u=who($db);
 if(in_array($action,['smtp_status','smtp_save','smtp_test'],true)){
  if($u['role']!=='controller')fail('Controller access required.',403);
  if($action==='smtp_status')respond(['configured'=>is_file($root.'/smtp.json'),'host'=>'mail.example.com','port'=>465,'username'=>'noreply@example.com','test_recipient'=>$u['email']]);
  throttle($db,'smtp_settings',5);
  if($action==='smtp_save'){
   $password=(string)($input['password']??'');if($password===''||strlen($password)>1024)fail('Enter the mailbox password.');$config=['password'=>$password];
   try{$mail=portalMailer($root,$config);if(!$mail->smtpConnect())fail('SMTP authentication failed. Check the mailbox password and server settings.',400);$mail->smtpClose();}catch(Throwable $e){fail('Could not authenticate with the mail server. Check the mailbox password or hosting connection.',400);}
   $temp=$root.'/smtp-'.bin2hex(random_bytes(8)).'.tmp';$oldMask=umask(0077);$written=file_put_contents($temp,json_encode($config,JSON_UNESCAPED_SLASHES),LOCK_EX);umask($oldMask);if($written===false||!chmod($temp,0600)||!rename($temp,$root.'/smtp.json')){if(is_file($temp))unlink($temp);throw new RuntimeException('Could not save private SMTP settings');}audit($db,(int)$u['id'],'smtp_configured','noreply@example.com');respond(['ok'=>true]);
  }
  if(!sendPortalEmail($root,$u['email'],'RecycleProof email delivery test','This is a test from your RecycleProof workspace. Password-reset messages use this same authenticated SMTP connection.'))fail('The test email could not be sent. Check Email settings.',503);
  audit($db,(int)$u['id'],'smtp_test','controller');respond(['ok'=>true,'message'=>'Mail server accepted the test email. Check your inbox and spam folder.']);
 }

 if($action==='users'){
  if($u['role']!=='controller')fail('Controller access required.',403);
  respond(['users'=>array_map('cleanUser',$db->query('SELECT * FROM users WHERE archived=0 ORDER BY created_at DESC')->fetchAll())]);
 }
 if($action==='user_status'){
  if($u['role']!=='controller')fail('Controller access required.',403);
  $id=(int)($input['id']??0);$status=(string)($input['status']??'');if(!in_array($status,['active','suspended'],true))fail('Invalid status.');
  $target=run($db,'SELECT * FROM users WHERE id=?',[$id])->fetch();if(!$target||$target['role']==='controller')fail('Controller access cannot be changed here.',403);
  $db->beginTransaction();run($db,'UPDATE users SET status=? WHERE id=?',[$status,$id]);audit($db,(int)$u['id'],'account_'.$status,(string)$id);$db->commit();respond(['ok'=>true]);
 }
 $select='SELECT b.*,c.name AS collector_name,r.name AS recycler_name FROM batches b JOIN users c ON c.id=b.collector_id JOIN users r ON r.id=b.recycler_id';
 if($action==='batches'){
  $bs=$u['role']==='controller'?$db->query($select.' ORDER BY b.id DESC')->fetchAll():run($db,$select.' WHERE b.collector_id=? OR b.recycler_id=? ORDER BY b.id DESC',[$u['id'],$u['id']])->fetchAll();
  $recyclers=$db->query('SELECT id,name,organization FROM users WHERE role="recycler" AND status="active" ORDER BY name')->fetchAll();respond(['batches'=>$bs,'recyclers'=>$recyclers]);
 }
 if($action==='create_batch'){
  if(!in_array($u['role'],['collector','controller'],true))fail('Collector access required.',403);
  $ref=field($input,'reference',60);if(!preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{2,59}$/',$ref))fail('Use 3–60 letters, numbers, dots, dashes or underscores for the reference.');
  $material=field($input,'material',50);if(!in_array($material,['PET plastic','HDPE plastic','Paper','Aluminium','Mixed / unknown'],true))fail('Select a valid material.');
  $weight=filter_var($input['weight']??null,FILTER_VALIDATE_FLOAT);if($weight===false||!is_finite($weight)||$weight<0.01||$weight>100000)fail('Weight must be between 0.01 and 100000 kg.');$weight=round($weight,2);
  $location=field($input,'location',150);$notes=trim((string)($input['notes']??''));if(strlen($notes)>1000)fail('Notes are too long.');
  $rid=(int)($input['recycler_id']??0);$r=run($db,'SELECT id FROM users WHERE id=? AND role="recycler" AND status="active"',[$rid])->fetch();if(!$r||(int)$u['id']===$rid)fail('Select an approved, separate recycler.');
  if(run($db,'SELECT id FROM batches WHERE reference=?',[$ref])->fetch())fail('Batch reference already exists.',409);
  $photo=null;
  if(isset($_FILES['photo'])&&$_FILES['photo']['error']!==UPLOAD_ERR_NO_FILE){$file=$_FILES['photo'];if($file['error']!==UPLOAD_ERR_OK||$file['size']>3*1024*1024)fail('Use a JPEG or PNG photo smaller than 3 MB.');$mime=(new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);if(!in_array($mime,['image/jpeg','image/png'],true)||!getimagesize($file['tmp_name']))fail('Invalid image.');$folder=$root.'/photos';if(!is_dir($folder))mkdir($folder,0700,true);$photo=bin2hex(random_bytes(20)).($mime==='image/png'?'.png':'.jpg');if(!move_uploaded_file($file['tmp_name'],$folder.'/'.$photo))throw new RuntimeException('Photo upload failed');chmod($folder.'/'.$photo,0600);}
  $time=gmdate('c');$hash=hash('sha256',json_encode(['reference'=>$ref,'material'=>$material,'weight'=>$weight,'collector_id'=>$u['id'],'recycler_id'=>$rid,'location'=>$location,'notes'=>$notes,'created_at'=>$time,'photo_hash'=>$photo?hash_file('sha256',$root.'/photos/'.$photo):null],JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE));
  $db->beginTransaction();run($db,'INSERT INTO batches(reference,material,weight,collector_id,recycler_id,location,notes,photo,status,created_at,collection_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?)',[$ref,$material,$weight,$u['id'],$rid,$location,$notes,$photo,'collected',$time,$hash]);audit($db,(int)$u['id'],'collection_registered',$ref);$db->commit();respond(['ok'=>true]);
 }
 if($action==='receive'||$action==='flag'){
  if($u['role']!=='recycler')fail('Only the nominated recycler can confirm or flag receipt.',403);
  $id=(int)($input['id']??0);$b=run($db,'SELECT * FROM batches WHERE id=?',[$id])->fetch();if(!$b||(int)$b['recycler_id']!==(int)$u['id'])fail('Batch not found.',404);if($b['status']!=='collected')fail('This batch is already processed.',409);
  $time=gmdate('c');$receipt=$action==='receive'?field($input,'receipt',100):'';$hash=hash('sha256',json_encode(['collection_hash'=>$b['collection_hash'],'recycler_id'=>$u['id'],'receipt'=>$receipt,'action'=>$action,'time'=>$time]));
  $db->beginTransaction();$stmt=run($db,'UPDATE batches SET status=?,received_at=?,receipt=?,receipt_hash=? WHERE id=? AND status="collected"',[$action==='receive'?'received':'flagged',$action==='receive'?$time:null,$receipt,$hash,$id]);if($stmt->rowCount()!==1){$db->rollBack();fail('Another request already processed this batch.',409);}audit($db,(int)$u['id'],$action==='receive'?'receipt_confirmed':'mismatch_reported',$b['reference']);$db->commit();respond(['ok'=>true]);
 }
 if($action==='photo'){
  $b=run($db,'SELECT * FROM batches WHERE id=?',[(int)($_GET['id']??0)])->fetch();if(!$b||!visible($u,$b)||!$b['photo'])fail('Photo not found.',404);$path=$root.'/photos/'.basename($b['photo']);if(!is_file($path))fail('Photo not found.',404);header('Content-Type: '.(str_ends_with($path,'.png')?'image/png':'image/jpeg'));header('Content-Length: '.filesize($path));readfile($path);exit;
 }
 fail('Unknown operation.',404);
} catch(Throwable $e) {if(isset($db)&&$db->inTransaction())$db->rollBack();error_log('RecycleProof: '.$e->getMessage());respond(['error'=>'The request could not be completed. Please retry or contact the controller.'],500);}

