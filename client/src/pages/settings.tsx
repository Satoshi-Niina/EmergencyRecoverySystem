import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Settings, Info, User, Bell, Shield, Database, Volume2, UserPlus, FileType, Book, LogOut } from "lucide-react";
import { WarningDialog } from "@/components/shared/warning-dialog";
import { Link } from "wouter";

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
    <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-5xl mx-auto w-full bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          <Settings className="mr-2 h-6 w-6 text-indigo-500" />
          設定
        </h1>
        <p className="text-blue-400">アプリケーションの設定を管理します</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Profile */}
        <Card className="border border-blue-200 shadow-md overflow-hidden">
          <CardHeader className="pb-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardTitle className="text-lg flex items-center">
              <User className="mr-2 h-5 w-5" />
              ユーザープロフィール
            </CardTitle>
          </CardHeader>
          <CardContent className="bg-white">
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-blue-800">{user?.displayName}</p>
                  <p className="text-sm text-blue-400">{user?.username}</p>
                  <p className="text-sm text-blue-400">{user?.department || '部署未設定'}</p>
                </div>
                <div className={`text-white text-xs px-3 py-1 rounded-full ${user?.role === 'admin' ? 'bg-gradient-to-r from-purple-500 to-indigo-500' : 'bg-gradient-to-r from-blue-500 to-green-500'}`}>
                  {user?.role === 'admin' ? '管理者' : '一般ユーザー'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="border border-green-200 shadow-md overflow-hidden">
          <CardHeader className="pb-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white">
            <CardTitle className="text-lg flex items-center">
              <Bell className="mr-2 h-5 w-5" />
              通知設定
            </CardTitle>
          </CardHeader>
          <CardContent className="bg-white">
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-green-700">通知を有効にする</p>
                  <p className="text-sm text-green-400">新しいメッセージの通知を受け取る</p>
                </div>
                <Switch 
                  checked={notifications} 
                  onCheckedChange={setNotifications}
                  className="data-[state=checked]:bg-green-500"
                />
              </div>
              
              <div className="flex items-center justify-between py-2 border-t border-green-100 pt-3">
                <div>
                  <p className="font-medium text-green-700">音声読み上げ</p>
                  <p className="text-sm text-green-400">AI応答を音声で読み上げる</p>
                </div>
                <Switch 
                  checked={textToSpeech} 
                  onCheckedChange={setTextToSpeech}
                  className="data-[state=checked]:bg-green-500"
                />
              </div>
              
              {textToSpeech && (
                <div className="py-2 border-t border-green-100 pt-3">
                  <p className="font-medium mb-2 text-green-700">音声の音量</p>
                  <Slider 
                    value={speechVolume} 
                    onValueChange={setSpeechVolume}
                    max={100}
                    step={1}
                    className="data-[state=checked]:bg-green-500"
                  />
                  <div className="flex justify-between mt-1">
                    <Volume2 className="h-4 w-4 text-green-400" />
                    <span className="text-sm text-green-500 font-medium">{speechVolume[0]}%</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* App Settings */}
        <Card className="border border-purple-200 shadow-md overflow-hidden">
          <CardHeader className="pb-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white">
            <CardTitle className="text-lg flex items-center">
              <Settings className="mr-2 h-5 w-5" />
              アプリ設定
            </CardTitle>
          </CardHeader>
          <CardContent className="bg-white">
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-purple-700">ダークモード</p>
                  <p className="text-sm text-purple-400">暗い色のテーマを使用する</p>
                </div>
                <Switch 
                  checked={darkMode} 
                  onCheckedChange={setDarkMode}
                  className="data-[state=checked]:bg-purple-500"
                />
              </div>
              
              <div className="flex items-center justify-between py-2 border-t border-purple-100 pt-3">
                <div>
                  <p className="font-medium text-purple-700">自動保存</p>
                  <p className="text-sm text-purple-400">会話を自動的に保存する</p>
                </div>
                <Switch 
                  checked={autoSave} 
                  onCheckedChange={setAutoSave}
                  className="data-[state=checked]:bg-purple-500"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin Settings (only shown for admins) */}
        {user?.role === 'admin' && (
          <Card className="border border-amber-200 shadow-md overflow-hidden">
            <CardHeader className="pb-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
              <CardTitle className="text-lg flex items-center">
                <Shield className="mr-2 h-5 w-5" />
                管理者設定
              </CardTitle>
            </CardHeader>
            <CardContent className="bg-white">
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium text-amber-700">ユーザー管理</p>
                    <p className="text-sm text-amber-400">ユーザーアカウントを管理する</p>
                  </div>
                  <Link href="/users">
                    <Button variant="outline" size="sm" className="border-amber-300 text-amber-700 hover:bg-amber-50">
                      <UserPlus className="mr-2 h-4 w-4 text-amber-500" />
                      管理
                    </Button>
                  </Link>
                </div>
                
                <div className="flex items-center justify-between py-2 border-t border-amber-100 pt-3">
                  <div>
                    <p className="font-medium text-amber-700">ドキュメント管理</p>
                    <p className="text-sm text-amber-400">検索対象の資料を管理する</p>
                  </div>
                  <Link href="/documents">
                    <Button variant="outline" size="sm" className="border-amber-300 text-amber-700 hover:bg-amber-50">
                      <FileType className="mr-2 h-4 w-4 text-amber-500" />
                      管理
                    </Button>
                  </Link>
                </div>

                <div className="flex items-center justify-between py-2 border-t border-amber-100 pt-3">
                  <div>
                    <p className="font-medium text-amber-700">ログアウト</p>
                    <p className="text-sm text-amber-400">システムからログアウトする</p>
                  </div>
                  <Button 
                    onClick={handleLogout} 
                    variant="outline" 
                    size="sm" 
                    className="border-red-300 text-red-700 hover:bg-red-50"
                  >
                    <LogOut className="mr-2 h-4 w-4 text-red-500" />
                    ログアウト
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* About */}
        <Card className="border border-blue-200 shadow-md overflow-hidden">
          <CardHeader className="pb-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white">
            <CardTitle className="text-lg flex items-center">
              <Info className="mr-2 h-5 w-5" />
              このアプリについて
            </CardTitle>
          </CardHeader>
          <CardContent className="bg-white">
            <div className="space-y-3">
              <p className="text-sm font-medium text-blue-700">Emergency Recovery Chat</p>
              <p className="text-sm text-cyan-500">バージョン 1.0.0</p>
              <p className="text-sm text-cyan-500">© 2024 All Rights Reserved</p>
              <div className="pt-2 mt-2 border-t border-blue-100">
                <p className="text-xs text-blue-400">
                  緊急復旧サポートのための対話型アシスタントシステム
                </p>
              </div>
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
