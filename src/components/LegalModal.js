import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors as C } from '../theme';
import { Button, Icon } from './UI';

const documents = {
  privacy: {
    title: '隐私政策',
    updated: '更新日期：2026年10月11日',
    sections: [
      ['我们收集的信息', '为了显示运行中的应用并执行你创建的限制规则，应用会在本机读取程序名称、进程编号、窗口标题和程序路径。应用还会保存限制规则、使用时长及设置偏好。'],
      ['信息如何使用', '这些信息仅用于识别应用、计算使用时间、执行限制以及展示本机统计，不用于广告画像或向第三方出售。'],
      ['本地存储', '程序列表、限制规则和使用记录默认只保存在当前电脑。当前版本不会将这些数据上传到服务器。'],
      ['权限说明', '应用只请求实现计时和限制所必要的系统权限。受 Windows 权限限制，部分管理员程序可能无法被检测或限制。'],
      ['你的控制权', '你可以暂停或删除单项限制规则。卸载应用后，可自行删除应用数据目录中的本地记录。'],
      ['政策更新', '功能或数据处理方式发生变化时，我们会更新本政策，并在应用内标明新的更新日期。']
    ]
  },
  terms: {
    title: '用户协议',
    updated: '生效日期：2026年10月11日',
    sections: [
      ['服务说明', '本应用用于帮助用户管理软件使用时间、建立限制规则并减少非计划的软件使用。'],
      ['用户责任', '你应当仅对自己有权管理的电脑和程序设置限制，并妥善保存工作内容，避免程序关闭造成未保存数据丢失。'],
      ['系统行为', '启用规则后，应用可能读取运行状态、记录使用时长，并根据你选择的限制方式提醒、关闭或阻止目标程序。'],
      ['服务限制', '受系统权限、程序更新及安全软件影响，检测和限制功能可能出现延迟或暂时不可用。本应用不能替代操作系统安全软件。'],
      ['禁止用途', '不得利用本应用干扰他人设备、规避系统权限或实施任何违反法律法规的行为。'],
      ['协议变更', '产品能力发生重大变化时，我们会同步更新本协议。继续使用更新后的版本视为接受修订内容。']
    ]
  }
};

export function LegalModal({ type, onClose }) {
  const document = type ? documents[type] : null;
  return (
    <Modal visible={Boolean(document)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <View style={styles.header}><View><Text style={styles.title}>{document?.title}</Text><Text style={styles.updated}>{document?.updated}</Text></View><Pressable accessibilityLabel="关闭" onPress={onClose} style={styles.close}><Icon name="close" color={C.secondary} /></Pressable></View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator>
            {document?.sections.map(([heading, copy]) => <View key={heading} style={styles.section}><Text style={styles.heading}>{heading}</Text><Text style={styles.copy}>{copy}</Text></View>)}
          </ScrollView>
          <View style={styles.footer}><Text style={styles.localNote}>内容与数据均可在应用内查看，默认仅本机处理</Text><Button onPress={onClose} style={styles.button}>我知道了</Button></View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.58)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 680, maxHeight: '82%', backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden' },
  header: { paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: C.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: C.ink, fontSize: 21, fontWeight: '900' }, updated: { color: C.muted, fontSize: 11, marginTop: 5 }, close: { width: 36, height: 36, borderRadius: 9, backgroundColor: '#F3F4F7', alignItems: 'center', justifyContent: 'center' },
  scroll: { flexShrink: 1 }, content: { padding: 24, gap: 20 }, section: { gap: 7 }, heading: { color: C.ink, fontSize: 14, fontWeight: '800' }, copy: { color: C.secondary, fontSize: 12, lineHeight: 21 },
  footer: { paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1, borderTopColor: C.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }, localNote: { color: C.muted, fontSize: 10, flex: 1 }, button: { minWidth: 110 }
});
