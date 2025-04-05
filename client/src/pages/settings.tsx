import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Settings, Info, LogOut, User, Bell, Shield, Database, Volume2 } from "lucide-react";
import { WarningDialog } from "@/components/shared/warning-dialog";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  
  // Settings state
  const [notifications, setNotifications] = useState(true);
  const [textToSpeech, setTextToSpeech] = useState(true);
  const [speechVolume, setSpeechVolume] = useState([80]);
  const [darkMode, setDarkMode] = useState(false);
  const [autoSave, setAutoSave] = useState(true);

  const handleLogout = async () => {
    setShowWarningDialog(true);
  };

  const confirmLogout = async () => {
    try {
      await logout();
    } catch (error) {
      toast({
        title: "ログアウト失敗",
        description: "ログアウト中にエラーが発生しました。",
        variant: "destructive",
      });
    } finally {
      setShowWarningDialog(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-5xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center">
          <Settings className="mr-2 h-6 w-6" />
          設定
        </h1>
        <p className="text-neutral-300">アプリケーションの設定を管理します</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Profile */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <User className="mr-2 h-5 w-5" />
              ユーザープロフィール
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">{user?.displayName}</p>
                  <p className="text-sm text-neutral-300">{user?.username}</p>
                </div>
                <div className="bg-primary text-white text-xs px-2 py-1 rounded-full">
                  {user?.role === 'admin' ? '管理者' : '一般ユーザー'}
                </div>
              </div>
              
              <Button onClick={handleLogout} variant="outline" className="w-full">
                <LogOut className="mr-2 h-4 w-4" />
                ログアウト
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <Bell className="mr-2 h-5 w-5" />
              通知設定
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">通知を有効にする</p>
                  <p className="text-sm text-neutral-300">新しいメッセージの通知を受け取る</p>
                </div>
                <Switch 
                  checked={notifications} 
                  onCheckedChange={setNotifications} 
                />
              </div>
              
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">音声読み上げ</p>
                  <p className="text-sm text-neutral-300">AI応答を音声で読み上げる</p>
                </div>
                <Switch 
                  checked={textToSpeech} 
                  onCheckedChange={setTextToSpeech} 
                />
              </div>
              
              {textToSpeech && (
                <div className="py-2">
                  <p className="font-medium mb-2">音声の音量</p>
                  <Slider 
                    value={speechVolume} 
                    onValueChange={setSpeechVolume}
                    max={100}
                    step={1}
                  />
                  <div className="flex justify-between mt-1">
                    <Volume2 className="h-4 w-4 text-neutral-300" />
                    <span className="text-sm text-neutral-300">{speechVolume[0]}%</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* App Settings */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <Settings className="mr-2 h-5 w-5" />
              アプリ設定
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">ダークモード</p>
                  <p className="text-sm text-neutral-300">暗い色のテーマを使用する</p>
                </div>
                <Switch 
                  checked={darkMode} 
                  onCheckedChange={setDarkMode} 
                />
              </div>
              
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">自動保存</p>
                  <p className="text-sm text-neutral-300">会話を自動的に保存する</p>
                </div>
                <Switch 
                  checked={autoSave} 
                  onCheckedChange={setAutoSave} 
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin Settings (only shown for admins) */}
        {user?.role === 'admin' && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <Shield className="mr-2 h-5 w-5" />
                管理者設定
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium">データベース管理</p>
                    <p className="text-sm text-neutral-300">システムデータベースを管理する</p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Database className="mr-2 h-4 w-4" />
                    管理
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* About */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <Info className="mr-2 h-5 w-5" />
              このアプリについて
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm">Emergency Recovery Chat</p>
              <p className="text-sm text-neutral-300">バージョン 1.0.0</p>
              <p className="text-sm text-neutral-300">© 2024 All Rights Reserved</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warning Dialog */}
      <WarningDialog
        open={showWarningDialog}
        title="ログアウト確認"
        message="ログアウトしてもよろしいですか？未保存のデータは失われる可能性があります。"
        onCancel={() => setShowWarningDialog(false)}
        onConfirm={confirmLogout}
      />
    </div>
  );
}
