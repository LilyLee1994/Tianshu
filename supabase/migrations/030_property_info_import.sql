-- 个体表里的「房源基本情况」→ 房源档案（来自 CC / Qily / Becky / zoe / Stephany 的个体表，已不做的房源不导）
-- 只填档案里还是空的项，已经填过的不会被覆盖。房源名按字母数字匹配（忽略大小写、空格、符号）。
alter table public.property_details add column if not exists guidebook_url text;
alter table public.property_details alter column bathrooms type numeric(3,1);

create temp table _info(k1 text, k2 text, label text, bedrooms numeric, bathrooms numeric, beds text, appliances text[],
  lock_location text, lock_code text, wifi_name text, wifi_password text, parking text, bin_day text, guidebook text, notes text);
insert into _info values
('botany407a','botany407a','Botany407A',3.0,2.0,'3 double',array['炉灶','烤箱','冰箱','微波炉','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','电视（智能）','空调：中央空调']::text[],null,'191','Belong73A4D','he6ucttfhgyy','1 个车位 停车场  D407','垃圾房在ground floor','https://drive.google.com/file/d/1PpoePcyCHgYr_Kkv2hgrkq8sjVWk7ClL/view?usp=sharing','空调分布：全屋中央空调
WiFi 供应商：澳世'),
('botany109b','botany109b','Botany109B',1.0,1.0,'1Queen',array['炉灶','烤箱','冰箱','微波炉','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','电视（智能）','空调：中央空调']::text[],null,'7777','SSID: Occom_9048_2.4G','4t3t9ex?n6','0 个车位 没有','垃圾房在ground floor','https://drive.google.com/file/d/16ohZaS8r2NbqQKcufXFH6-dolZdelwvK/view?usp=drive_link','特点：The pin for mailbox:109
The pin for lockbox:1098
The pin for first door:1091
The pin for apt:1098 
109打开mailbox 1098打开lockbox 1091打开第一扇门 1098打开房门
房间：房间1：一张1.5宽双人床
空调分布：全屋中央空调
WiFi 供应商：澳世'),
('collary51','collary51downstairs','Collary51',3.0,1.0,'3Queen 2single；沙发床 1',array['炉灶','烤箱','洗碗机','电饭煲','冰箱','微波炉','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','泳池','电视（智能）','空调：挂式空调']::text[],null,'0051','51Guest','20240730','1 个车位 street parking',null,'https://drive.google.com/file/d/1nAw50-VJ52HFKx3UjTvSfNoownvl0-Td/view?usp=drive_link','特点：房东住楼上 仅一层可用 距离海滩很近
房间：房间1：一张双人床 两张单人床 房间2：一张双人床 房间3：一张双人床 附加：1张沙发床。
空调分布：只有客厅有空调 房间配备风扇或者暖气
备用锁盒：不知道'),
('haymarket801','haymarket801','Haymarket801',3.0,2.0,'3Queen；沙发床 1',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','泳池','健身房','电视（智能）','空调：中央空调']::text[],null,'8802','Occom_E68C_2.4G','JYaNY3uJ','1 个车位 underground parking',null,'https://drive.google.com/file/d/1hrW002nqL6HEFc0Egv6LE2EinLmGJXuq/view?usp=drive_link','房间：房间1：一张双人床 房间2：一张双人床 房间3：一张双人床  附加：1张沙发床（可睡一人)
空调分布：全屋中央空调
备用锁盒：COCO不知道'),
('marrickville01','marrickville01','Marrickville 01',2.0,1.0,'2 Queen；沙发床 1',array['炉灶','烤箱','洗碗机','冰箱','微波炉','吹风机','烘干机','洗衣机','熨斗和烫板','电视（智能）','空调：分体空调']::text[],null,'5601','路由器背面，让客人自己查看','路由器背面，让客人自己查看','1 个车位 地下停车库 1',null,'https://drive.google.com/file/d/1qY0PbV2TgXqK9Nw0K6tH2y5yfGZheBab/view?usp=drive_link','空调分布：中央空调
备用锁盒：Y 在信箱对面栏杆上挂着
WiFi 供应商：澳世'),
('marrickville02','marrickville02','Marrickville 02',1.0,1.0,'1 Queen；沙发床 1',array['炉灶','烤箱','洗碗机','冰箱','微波炉','吹风机','烘干机','洗衣机','熨斗和烫板','电视（智能）','空调：分体空调']::text[],null,'9902','路由器背面，让客人自己查看','路由器背面，让客人自己查看','1 个车位 没有停车场，但是空的话可以让客人随便停',null,'https://drive.google.com/file/d/1AIHBvnx6rwuGFVF-zBnMMXAS_NVwSyY7/view?usp=drive_link','特点：还没有专业摄影师拍照
空调分布：中央空调
备用锁盒：Y 在信箱对面栏杆上挂着
WiFi 供应商：澳世'),
('marrickville03','marrickville03','Marrickville 03',1.0,1.0,'1 Queen；沙发床 1',array['炉灶','烤箱','洗碗机','冰箱','微波炉','吹风机','烘干机','洗衣机','熨斗和烫板','电视（智能）','空调：分体空调']::text[],null,'1111','Occom_D4FE_2.4G
Occom_D4FE_5G','bn53?2gec2','1 个车位 地下停车库 3号',null,'https://drive.google.com/file/d/1cC34MHWnpTJoP_00gmUN5v7A_l_O3wuG/view?usp=sharing','特点：锁盒在走廊 的两边挂着， 锁盒边上写了1 ，密码1111
空调分布：中央空调
备用锁盒：Y
WiFi 供应商：澳世'),
('marrickville04','marrickville04','Marrickville 04',1.0,1.0,'1 Queen；沙发床 1',array['炉灶','烤箱','洗碗机','冰箱','微波炉','吹风机','烘干机','洗衣机','熨斗和烫板','电视（智能）','空调：分体空调']::text[],null,'8819','路由器背面，让客人自己查看','路由器背面，让客人自己查看','1 个车位 地下停车库 4号',null,'https://drive.google.com/file/d/1pAw-5QuPa64zgBH4lQCqA4jQFtlIpbox/view','空调分布：中央空调
备用锁盒：Y 在信箱对面栏杆上挂着
WiFi 供应商：澳世'),
('marrickville05','marrickville05','Marrickville 05',2.0,1.0,'2 queen；沙发床 1',array['炉灶','烤箱','洗碗机','冰箱','微波炉','吹风机','烘干机','洗衣机','熨斗和烫板','电视（智能）','空调：分体空调']::text[],null,'5695','路由器背面，让客人自己查看','路由器背面，让客人自己查看','1 个车位 地下停车库 5号',null,'https://drive.google.com/file/d/1ZCWJL2wA0c5SovI7SuW7gOY_1DM_tbsf/view?usp=drive_link','空调分布：中央空调
备用锁盒：Y 在信箱对面栏杆上挂着
WiFi 供应商：澳世'),
('marrickville06','marrickville06','Marrickville 06',1.0,1.0,'1 queen；沙发床 1',array['炉灶','烤箱','洗碗机','冰箱','微波炉','吹风机','烘干机','洗衣机','熨斗和烫板','电视（智能）','空调：分体空调']::text[],null,'5656','路由器背面，让客人自己查看','路由器背面，让客人自己查看','1 个车位 地下停车库6号',null,'https://drive.google.com/file/d/1I5Np1Q2gBm1hd1a-yDaBZR5nBwgymC5I/view?usp=drive_link','空调分布：中央空调
备用锁盒：Y 在信箱对面栏杆上挂着
WiFi 供应商：澳世'),
('mascot17','mascot17','Mascot 17',3.0,2.0,'2 double ， 1 queen；沙发床 1',array['炉灶','烤箱','洗碗机','冰箱','微波炉','吹风机','烘干机','洗衣机','熨斗和烫板','电视（智能）','空调：分体空调']::text[],null,'0817','Occom_CBBE_2.4G','df6xyd@252','1 个车位 车位号 17 ， 地下车库',null,'https://drive.google.com/file/d/1rnZ91Cro_Fh-tcdUN8tdoLLIGyjywVBZ/view?usp=sharing','特点：钥匙在后院， 不需要钥匙可以直接进去 找锁盒
空调分布：中央空调
WiFi 供应商：澳世'),
('pyrmont216','pyrmont216','Pyrmont216',1.0,1.0,'1Queen；沙发床 1',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','电视（智能）','空调：中央空调']::text[],null,'7216','mobile device','插上电可以看见','0 个车位 无','同一楼垃圾房','https://drive.google.com/file/d/1UNTeI5sfiF8eVeIekXZTeI_6us2W6KBC/view?usp=drive_link','特点：位置很好，房子很老
房间：房间1：一张双人床 附加：1张沙发床
空调分布：全屋
备用锁盒：COCO不知道
WiFi 供应商：公司的'),
('pyrmont715','pyrmont715','Pyrmont715',1.0,1.0,'1Queen；沙发床 1',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','电视（智能）','空调：中央空调']::text[],null,'0707','0ccom A066 2.4G','07720048','0 个车位 无','同一层楼垃圾房','https://drive.google.com/file/d/1XlOf91jkZz_-2b_J6b_Y6L8L1O_NyLau/view?usp=drive_link','特点：房源大楼很老，位置很好
房间：房间1：一张双人床 附加：1张沙发床
空调分布：全屋
WiFi 供应商：澳世'),
('redfern302','redfern302','Redfern 302',2.0,2.0,'2 QUEEN BED；沙发床 1',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','电视（智能）','空调：挂式']::text[],null,'7780','TP-Link 81D5','25724059','1 个车位 车库停车位',null,'https://drive.google.com/file/d/1KCcQxInaAGIHQx1kWt2qyMZvQw71yAae/view?usp=drive_link','特点：有泳池和健身房
空调分布：客厅有台式，卧室里面有吊扇
WiFi 供应商：房东'),
('rosebery305','rosebery305','Rosebery 305',2.0,2.0,'2 QUEEN BED',array['炉灶','烤箱','洗碗机','冰箱','微波炉','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','电视（智能）','空调：分体空调']::text[],null,'0305','Occom_82F4_5G','k9#nabdang','1 个车位 车库停车位',null,'https://drive.google.com/file/d/1Xsuaw-gHfBqJOdOfUdYINa4CJ1SLu-1k/view?usp=drive_link','房间：有一个气垫床（公司的）
空调分布：中央空调
WiFi 供应商：澳世'),
('shelley410','shelley410','Shelley410',3.0,2.0,'3Queen；沙发床 1',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','洗衣机','熨斗和烫板','吸尘器','电视（智能）','空调：中央空调']::text[],null,'0818','Name：Wi-Fi 40C1AF 5G','2k2heTQy','1 个车位 underground parking','垃圾房在同一层楼','https://drive.google.com/file/d/17ymqnTipdaOp4WECfY6Iaxga0wE7gc1D/view?usp=drive_link','特点：地理位置很好，CBD
房间：房间1：一张双人床 房间2：一张双人床 房间3：一张双人床 附加：1张沙发床。  1个书房改卧室
空调分布：全屋分布'),
('sydney1306','sydney1306','Sydney 1306',2.0,1.0,'2Queen；沙发床 1',array['炉灶','烤箱','洗碗机','冰箱','微波炉','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','电视（智能）','空调：中央空调']::text[],null,'1306','Occom_DA56_2.4G Occom_DA56_5G','hf2p4&m245','0 个车位 没有停车位','垃圾房在同一层','https://drive.google.com/file/d/1EVu-T1n4DWtnPvIa8PQuCjPFIpMG-v1w/view?usp=sharing','特点：步行约 3分钟即可抵达达令港，步行 5分钟内可到Town Hall 火车站
房间：房间1：一张双人床 房间2：一张双人床 房间3：一张双人床  附加：1张沙发床
空调分布：全屋中央空调
备用锁盒：待确认
WiFi 供应商：澳世'),
('daystreet188','daystreet188','Day Street 188',3.0,2.0,'3Queen；沙发床 1',array['炉灶','烤箱','洗碗机','冰箱','微波炉','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','电视（智能）','空调：中央空调']::text[],null,'8511','Occom_54C2_5G','e4yhqpht?7','1 个车位 underground parking','垃圾房在同一层','https://drive.google.com/file/d/1SLZ6QJeMTQz92PjH3aoZG5nkYjJPJU4T/view?usp=drive_link','特点：步行约 3分钟即可抵达达令港，步行 5分钟内可到Town Hall 火车站
房间：房间1：一张双人床 房间2：一张双人床 房间3：一张双人床  附加：1张沙发床
空调分布：全屋中央空调
备用锁盒：待确认
WiFi 供应商：澳世'),
('waterloo311','waterloo311','Waterloo 311',2.0,1.0,'2 QUEEN BED',array['炉灶','烤箱','洗碗机','冰箱','微波炉','吹风机','烘干机','洗衣机','熨斗和烫板','电视（智能）','空调：分体空调']::text[],'810/7311',null,'Occom 21BE 2.40/ Occom 21BE 5G','&q27gp5raf','0 个车位 There are street parking and visitor parking in the building
Street parking has 2 hours limited','垃圾房同一楼层','https://drive.google.com/file/d/1PtWmfeFDDKGLjhIV-TqYl3nVEDgir8eQ/view?usp=drive_link','特点：设施新
房间：一间书房改卧室
空调分布：中央空调
备用锁盒：没有
WiFi 供应商：澳世'),
('zetland126','zetland126','Zetland 126',1.0,1.0,'1 queen bed
2 single bed；沙发床 1',array['炉灶','烤箱','洗碗机','冰箱','微波炉','吹风机','烘干机','洗衣机','熨斗和烫板','电视（智能）','空调：分体空调']::text[],null,'0818','6G','5155@126','0 个车位 街道付费停车','同一楼层垃圾房','https://drive.google.com/file/d/10JtBjJXguHMqf8IrvGwXaR87CN1aBehB/view','特点：步行至 Green Square 火车站仅约5分钟 生活设施齐全
房间：1张大床， 2张单人床在客厅
空调分布：中央空调
WiFi 供应商：房东'),
('austral08','auatral08','Austral08',4.0,3.0,'4Q',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','洗衣机','熨斗和烫板','吸尘器','电视（智能）','空调：挂式空调']::text[],null,'8819','mao','m87654321','车库 提供车库','周四','https://drive.google.com/file/d/1UPn8k7cvjCjQyCGzw3IndTfkodFw7Ntm/view','特点：清洁费380
房间：楼上有3间卧室，两间浴室；楼下一间卧室一间浴室 卧室1：一张双人床，卧室2：一张双人床，卧室3：一张双人床，卧室4：一张双人床
空调分布：卧室和客厅都是挂式空调
备用锁盒：有 备用钥匙在电箱里面，密码是0808
WiFi 供应商：澳世'),
('austral18','austral18','Austral 18',4.0,2.5,'2q4s',array['炉灶','烤箱','洗碗机','电饭煲','冰箱','微波炉','浴缸','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','电视（智能）','空调：单体空调']::text[],null,'0707','NETGEAR78','unusualpanda293','2个停车位 =DISPIMG("ID_01BEE7D6BB534079B00536F549C983BE",1)','周四','"https://drive.google.com/file/d/1q1tmV7SBZfnYnS_1oXpSkaM_MgPfr00w/view?usp=drive_link
"','特点：可以容纳11人房子刚上线，设施设备新。是西南比较的好的房子之一
房间：楼上四间卧室，主卧带独立浴室，楼上两间浴室，楼下一个厕所和洗衣房在一起 卧室1：2张单人床，卧室2：2张单人床，卧室3：一张双人床，卧室4：一张双人床，
空调分布：每个房间都有 客厅共用一个
备用锁盒：有 备用锁盒在挂在门口的左边的电箱里面，密码是0808
WiFi 供应商：房东'),
('austral25','austral25','Austral 25',5.0,3.0,'5Q',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','电视（智能）','空调：中央空调']::text[],null,'8819','OPTUS 4BBB38N','hazel79343dc','streat parking 街道停车','周四','https://drive.google.com/file/d/1i8PlSvKmqR4bCOWb8VBfrsbkHIFkfUSP/view?usp=drive_link','房间：楼上有四间卧室，楼下一间卧室；楼上两间浴室楼下一间浴室 卧室1：一张双人床，卧室2：一张双人床，卧室3：一张双人床，卧室4：一张双人床，卧室5：一张双人床
空调分布：房间和客厅都是中央空调
备用锁盒：有 备用锁盒在电箱里
WiFi 供应商：房东'),
('austral74','austral74','Austral 74',5.0,3.5,'5Q',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','洗衣机','熨斗和烫板','吸尘器','电视（智能）','空调：中央空调+风扇']::text[],null,'7489','Kogan Mesh Wifi_91A0','Goonline@999','车库 车库停车位（可以通过车库进入房源）','周四','https://drive.google.com/file/d/1cOnUgD3LnZDgXzgm2JHcPGNtN1jMMDHQ/view?usp=drive_link','特点：距离 Leppington 火车站约 5 分钟车程，房东很在意评价
房间：楼上 4 间卧室， 2.5 间浴室，楼下 1 间卧室，楼下 1 间浴室 卧室1：一张双人床，卧室2：一张双人床，卧室3：一张双人床，卧室4：一张双人床，卧室5：一张双人床
空调分布：四间卧室中央空调
一间卧室配备风扇，共5个风扇可用
备用锁盒：待确认 待Coco确认'),
('bankstown29','bankstown29','Bankstown 29',3.0,1.5,'3Q',array['冰箱','微波炉','浴缸','吹风机','洗衣机','熨斗和烫板','电视（智能）','空调：挂式空调']::text[],null,'8819','Telstra367978','yxx5tbb7qt3gses3','街边/车库 街边，车库停车','周四','https://drive.google.com/file/d/1cNc21WUvxPZImiUBiOOpcWEcEKLg3ld8/view?usp=share_link','特点：距离 Bankstown Centro 购物中心约 1 公里,没有洗碗机
房间：楼上三间卧室和一个浴室；楼下有一个马桶 卧室1：一张双人床，卧室2：一张双人床，卧室3：一张双人床
空调分布：房间和客厅都是挂式空调
备用锁盒：有 在清洁工手上'),
('bankstown42','bankstown42','Bankstown 42',4.0,2.5,'4Q',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','洗衣机','熨斗和烫板','电视（智能）','空调：中央空调']::text[],null,'8819','-9B098F','54122796','车库/路边 前院可以停车','周四','https://docs.google.com/presentation/d/1x0TFY8yxmLOENUD7LjnhJuJEED3a0-bI/edit?usp=sharing&ouid=110733699984123945616&rtpof=true&sd=true','特点：距离 Bankstown Centro 购物中心约 1 公里。房东住附近，客人每次退房房东会过来检查一下房子，房子会你比较潮湿，关闭窗户就会有很多虫子需要多开窗
房间：楼上四间卧室；所有卫生间都在楼上，楼下设有厕所
空调分布：四件卧室和客厅都是中央空调
备用锁盒：有 在房东手上，房东就住在附近
WiFi 供应商：=DISPIMG("ID_1896F05950AC40A898DFBCEEF940F1C6",1)'),
('bardia173','bardia173','Bardia 173',4.0,3.0,'4Q',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','洗衣机','熨斗和烫板','吸尘器','电视（智能）','空调：中央空调']::text[],null,'8819','TP-LINK-35F2','69518591','车库 街边停车 有车库+街边停车','周四','https://drive.google.com/file/d/1HWvr7F6PShLL66xgwEPZeYXcHTRcfQ1j/view?usp=drive_link','特点：清洁费338
房间：楼上三间卧室和2个浴室；楼下一个卧室和一个浴室  楼下有一张king bed 卧室1：一张双人床，卧室2：一张双人床，卧室3：一张双人床，卧室4：一张双人床
空调分布：房间客厅都有
备用锁盒：有 备用锁盒在电箱上
WiFi 供应商：房东'),
('bardia38','bardia38','Bardia 38',5.0,3.0,'5Q',array['炉灶','烤箱','洗碗机','电饭煲','冰箱','微波炉','浴缸','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','电视（普通）','空调：中央空调']::text[],null,'0707','TP-Link 7804','23788909','车库、街边停车位 不提供车库，街边停车','周四','https://drive.google.com/file/d/1BXkpo1nBafbZktWuZuPiWur5PAPobZFp/view?usp=share_link','房间：楼上四间卧室和两间浴室，楼下一间卧室和浴室 卧室1：一张双人床，卧室2：一张双人床，卧室3：一张双人床，卧室4：一张双人床，卧室5：一张双人床
空调分布：卧室和客厅都是中央空调
备用锁盒：有 电箱上，报警密码是8337
WiFi 供应商：房东'),
('causla05','casula05','Causla05',3.0,2.0,'1.5米宽双人床+2张1.35米宽双人床；沙发床 3',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','电视（智能电视）','空调：挂式空调']::text[],null,'1981','Occom 92B4 5G/Occom 92B4 2.4G','w9#wyd5icx','车库/街边 车库可以停两辆车，街边可以停车','周一','https://docs.google.com/presentation/d/1BgslCw6kewo59mrvrady2U4uLy8X1oHG/edit?usp=drive_link&ouid=102696898088774374329&rtpof=true&sd=true','特点：清洁费365
房间：卧室一：1.8米宽双人床。卧室二：1.5米宽双人床，卧室三：1.35米宽双人床
备用锁盒：有 有备用钥匙，房东留了一套钥匙在她朋友那里，开车只需要5 分钟
WiFi 供应商：澳世'),
('catherinefield12','catherinefield12','Catherine Field 12',5.0,2.5,'5Q',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','洗衣机','熨斗和烫板','电视（智能）','空调：中央空调']::text[],null,'8819','Occom_92E2_5G','52452468','车库停车位 车库停车位','周四','https://drive.google.com/file/d/1kZVD-EDZrWlyWngSM2tQxeeCn61wKdlT/view?usp=share_link','房间：有一个主人套间。楼上四间卧室和2个浴室；楼下一个房间（有床，门是拖拉门）和马桶 卧室1：一张双人床，卧室2：一张双人床，卧室3：一张双人床，卧室4：一张双人床，卧室5：一张双人床
空调分布：中央空调
备用锁盒：无 没有备用钥匙'),
('denhamcourt40','denhamcourt40','Denham Court40',4.0,2.5,'4Q',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','洗衣机','熨斗和烫板','电视（智能）','空调：挂式空调']::text[],null,'8819','Occom_6A75_5G','60893086','免费停车位 车库停车位，小车可以停两辆','周三','https://drive.google.com/file/d/14DU2n_RoH7jM0dvyTjPt4DsJ_1tynYHl/view?usp=sharing','特点：清洁费338
房间：楼上四间卧室，2个浴室楼下有一个马桶 卧室1：一张双人床，卧室2：一张双人床，卧室3：一张双人床，卧室4：一张双人床
空调分布：挂式空调
备用锁盒：无 无备用钥匙'),
('denhamcourt20','denhamcourt20','Denham court 20',4.0,2.5,'4Q',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','洗衣机','熨斗和烫板','电视（智能）','空调：中央空调']::text[],null,'8819','Occom_FFB3','87991338','车库 提供 双车位锁闭车库供客人使用。','周二','https://drive.google.com/file/d/1bQ_jo-UivqqpwXtxoVSIihjbNnt-mZdR/view?usp=drive_link','房间：平层四间卧室，2个浴室楼下有一个马桶 卧室1：一张双人床，卧室2：一张双人床，卧室3：一张双人床，卧室4：一张双人床
空调分布：卧室和客厅都是中央空调
备用锁盒：有 在后院水龙头上 密码是1996'),
('edmondson47','edmondson47','Edmondson 47',4.0,2.5,'4Q',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','烘干机','洗衣机','熨斗和烫板','电视（智能）','空调：挂式空调']::text[],null,'0759','NETGEAR75','sillyfinch677','免费停车位 车库和街道停车','周二','https://drive.google.com/file/d/1MpS2Av0PPa9Cs6Grl-cB1LUEZGr9YYtR/view?usp=sharing','特点：清洁费350。有任何问题直接找房东
房间：楼上四间卧室和两间浴室，楼下半个卫生间 卧室1：一张双人床，卧室2：一张双人床，卧室3：一张双人床，卧室4：一张双人床
空调分布：客厅和卧室都有挂式空调
备用锁盒：无 没有备用锁盒'),
('leppington14','leppington14','Leppington 14',5.0,3.0,'5Q',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','洗衣机','熨斗和烫板','吸尘器','电视（智能电视）','空调：中央空调']::text[],null,'9818','sweethome','14leppington','车库停车位 车库停车位','周一','https://drive.google.com/file/d/1_kyGXkR7GUO8Q7s6vRi1ARUA-ELSnXNR/view?usp=sharing','特点：清洁费365
房间：楼上有四间卧室，一间卧室是主人套间，其他三个房间共用一个浴室，楼下1间卧室1间浴室 卧室1：一张双人床，卧室2：一张双人床，卧室3：一张双人床，卧室4：一张双人床,卧室5：一张双人床
空调分布：卧室和客厅是中央空调
备用锁盒：有 密码是0717
WiFi 供应商：房东'),
('stmary15','stmary15','St mary 15',2.0,1.0,'2张1.5米大床；沙发床 2',array['炉灶','烤箱','冰箱','微波炉','浴缸','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','电视（智能）']::text[],null,'0088','-4R4M1','Theme081West','停车位 门前有一个停车位，街边可停2辆车',null,'https://drive.google.com/file/d/17DoWVrrPd6N4rDcvKq6clvza4C8jBcZN/view?usp=drive_link','特点：清洁费：199。 房东自己打扫
房间：卧室一：1.5米大床， 卧室二：1.5米宽双人床  客厅一张沙发床和一张小型沙发床
空调分布：现在房间是两个空调扇，空调坏的
备用锁盒：无 有问题直接找房东'),
('liverpool1804','liverpool1804','Liverpool 1804',null,null,null,'{}'::text[],null,null,'分布',null,'分体空调 中央空调',null,null,'空调分布：邮箱'),
('liverpool203','liverpool203','Liverpool 203',1.0,1.0,'1 QUEEN BED；沙发床 1',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','电视（智能）','空调：分体空调']::text[],null,'810','occom_4cbe_5G','72373484','1 个车位 地下车库停车位',null,'https://drive.google.com/file/d/1VrwjvqMxyJuJesBRWA7b63sbNzEdokWu/view','房间：浴室和卧室是分开的
空调分布：客厅有一个挂式
WiFi 供应商：澳世'),
('liverpool2101','liverpool2101','Liverpool 2101',2.0,2.0,'2 QUEEN BED；沙发床 1',array['炉灶','冰箱','浴缸','吹风机','烘干机','洗衣机','熨斗和烫板','电视（智能）','空调：分体空调']::text[],null,'8819','TP_Link_46ED_5G','Pin:34632079','1 个车位 地下车库停车位',null,'https://drive.google.com/file/d/1aMqYbfgONakqBD52NeMbjyAgYKKNVmhH/view?usp=drive_link','房间：还有一个气垫床，是公司的
空调分布：中央空调
WiFi 供应商：TP'),
('boxhill02','boxhill02','Boxhill02',3.0,2.5,'4Q',array['炉灶','洗碗机','冰箱','微波炉','浴缸','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','电视','空调：挂式空调']::text[],null,'6188','Occom_0B07/Occom_0B07_5G','wUDnjEh8','0 个车位 双车位车库',null,'https://drive.google.com/file/d/1xbqp16U_OVcIlnz8zSqqGqnygyP01Dml/view?usp=drive_link','WiFi 供应商：澳世'),
('boxhill07','boxhill07','Boxhill07',3.0,2.0,'5',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','电视','空调：挂式空调']::text[],null,'0795','Occom_04EC/Occom_04EC_5G','zEs4X5sV','0 个车位 双车位车库','车库有个垃圾房','https://drive.google.com/file/d/1ZVyQvYNwTCPnoN803QUccSCeBzFOncdZ/view?usp=drive_link','WiFi 供应商：澳世'),
('cadens03','cadens03','cadens 03',5.0,2.5,'5Q',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','洗衣机','熨斗和烫板','吸尘器','泳池','电视','空调：中央空调']::text[],null,'258025#','TP-Link_E80D/ TP-Link_E80D_5G','15501165','0 个车位 Street parking/车库停车','周三','https://drive.google.com/file/d/1ccYLQggKUFG7Y0Bn15cquB5y3CTwnxz-/view?usp=drive_link','特点：Rouse Hill Town Centre（约5分钟车程）
Tallawong Metro Station（约6分钟车程）
房间：楼上有4间卧室，2间浴室/楼下有一间卧室带全套浴室和厕所
空调分布：客厅/房间
备用锁盒：Y 备用锁盒请看下方备注，里面有泳池的卡片，泳池不给使用了，现在只有rousehill145可以使用
WiFi 供应商：房东'),
('carlingford36','carlingford36','Carlingford 36',1.0,1.0,'1Q',array['炉灶','烤箱','冰箱','微波炉','吹风机','洗衣机','熨斗和烫板','吸尘器','电视','空调：挂式空调']::text[],null,'881988#','-82EFDE','20676049','0 个车位 Street parking','由于该房产是一间老奶奶公寓，请将垃圾丢到房产外的垃圾箱中，我们与主屋共用','https://drive.google.com/file/d/1i02e8H-j1oQS8FNZ3qCRPqF_p96DRQZn/view?usp=drive_link','特点：附近超市：

Coles Carlingford：​位于Carlingford Court购物中心内，距离约720米，步行约10分钟，营业时间为早上7:00至晚上10:00。 ​
Carlingford Court

Woolworths Carlingford：​同样位于Carlingford Court购物中心，距离约719米，步行约10分钟，营业时间为早上7:00至晚上10:00。 ​
Carlingford Court

Tong Li Supermarket：​位于Carlingford Court购物中心内，提供亚洲食品，营业时间为早上9:00至晚上9:00。 ​

Jusco Supermarket：​位于372 Pennant Hills Rd，提供多种亚洲食品选择，距离约1公里，步行约15分钟。 ​
Yelp

公共交通：

公交车站：​最近的公交车站是位于Pennant Hills Road的Roselea Community Centre站，距离约282米，步行约4分钟。经过该站的公交线路包括549、611和625路，可前往Parramatta、Epping等地。 ​

轻轨站：​Carlingford轻轨站是Parramatta轻轨L4线的终点站，距离约1.9公里，步行约26分钟。该线路连接Westmead、Parramatta CBD和Camellia等地。 ​
dailytelegraph

地铁站：​Cherrybrook地铁站距离约2.4公里，步行约31分钟，可搭乘M1线前往悉尼市中心和其他地区。 ​
公共交通指南

火车站：​Epping火车站提供T9北岸线和中央海岸及纽卡斯尔线（CCN）服务，连接悉尼市中心和北部地区，距离约4公里，驾车约10分钟。
房间：studio,1张1.8大床和一张沙发床可住3人
空调分布：客厅
WiFi 供应商：房东'),
('castlehill01','castlehill01','Castle Hill  01',4.0,2.0,'1K+1Q+2DB',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','婴儿床','电视','空调：中央空调']::text[],null,'6487','Castle Castle','0123456798','2 个车位 Street parking','Tuesday','https://drive.google.com/file/d/14ziEl3KZ1NgIKq45CyCt432ceAHjl4zP/view?usp=sharing','房间：二楼： 主卧配有 大号床（Queen bed） 带空调  第二间卧室配有 双人床（Double bed）+ 单人床（Single bed）带空调  第三间卧室配有 双人床（Double bed）带风扇  第四间卧室配有双人床（Queen bed）带风扇  1个独立浴室带浴缸+1个厕所   一楼：  宽敞的客厅配有舒适沙发、超大电视、书桌和餐桌  1个独立浴室+1个厕所
空调分布：部分房间没空调，客厅有空调
备用锁盒：/ 无
WiFi 供应商：房东'),
('castlehill83','castlehill832','Castle HIll 83',3.0,2.0,'3Q',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','电视','空调：挂式空调']::text[],null,'810','TP-Link 9DEA','11156512','2 个车位 地下2层有2个停车位 很大 可以作1个，按0可到1楼公寓 ， 车位在-2楼','垃圾房','https://drive.google.com/file/d/14_P-H5Hf2LepHy1zCAMlCfhCK4Lit6ZC/view','特点：离train station步行10分钟， taxi 5分钟 。
房间：3 间卧室3张床加沙发床2 个卫生间，1层公寓带2个停车位置
空调分布：其中一间卧室没有空调，但将提供风扇。
WiFi 供应商：房东'),
('gable07grannyflat','gable07grannyflat','Gable 07 Grannyflat',2.0,1.0,'2Q',array['炉灶','烤箱','洗碗机','冰箱','微波炉','吹风机','洗衣机','熨斗和烫板','吸尘器','电视','空调：挂式空调']::text[],null,'6689','-3A3D，or Wifi-4E25','68473907','Y Street parking','周三','https://drive.google.com/file/d/19b603-Ojr4gwZqr5KVTEhwXFxQmX5W6x/view?usp=share_link','特点：1.周边有多个公园和湖泊，如Lake Gables，适合休闲散步、亲子活动。
2.距离 Box Hill Town Centre 约5-7分钟车程，内有Woolworths超市、咖啡厅、餐厅、药房、医疗中心等
约5分钟可上 Windsor Road
15分钟到 Rouse Hill Town Centre
约20分钟到 Norwest Business Park
约50分钟直达悉尼CBD
房间：奶奶房,2张1.5大床1间卫生间可住4人
空调分布：客厅/房间
WiFi 供应商：房东'),
('hornsby02','hb02','Hornsby02',2.0,1.5,'2Queen；沙发床 2',array['浴缸','吹风机','烘干机','熨斗和烫板','吸尘器','电视（待coco回来确认）']::text[],'8819/2078',null,null,null,null,'AC','LEVEL 1
https://drive.google.com/file/d/1f7_xvhTPvDrZ6EA4crVeIxt2Gz16493W/view?usp=share_link
LEVEL 2
https://drive.google.com/file/d/121_V94ava9uddK2Tk6e6x4RO4Kix6Fjz/view?usp=sharing','特点：房子较老，但是被大自然包围
房间：房间1：一张双人床 房间2：一张双人床 房间3：一张双人床'),
('jordanspring10','jordanspring10','JordanSpring10',4.0,2.5,'5Q',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','洗衣机','熨斗和烫板','吸尘器','电视','空调：挂式空调']::text[],null,'5009','name: WIFI-WHE2M','Mair280Range','1 个车位 garage/Street parking 车库按钮在墙上','周一','https://drive.google.com/file/d/1fYJY6qJqYK1LFSVkrXYul5GsGcHLvDYT/view?usp=drive_link','特点：1. 地理位置优越，生活便利
购物与餐饮：​物业靠近Jordan Springs购物中心，内有Woolworths超市、咖啡馆和其他零售店，方便客人购买日常用品和享受餐饮服务。​
休闲娱乐：​周边拥有多个公园、湖泊和步道，适合客人进行散步、跑步和家庭聚会等户外活动。
房间：楼上3Q1S,楼下1Q，客厅会准备一张充气床垫 卧室1：一张双人床，卧室2：一张单人床，卧室3：一张双人床，卧室4：一张双人床    客厅有一张充气床垫
空调分布：客厅/房间'),
('kellyville01','kellyville01','Kellyville01',4.0,2.0,'4Q',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','烘干机','洗衣机','吸尘器','电视','空调：挂式空调']::text[],null,'2205*','occom_88c0','i5n&d5q4gp','0 个车位 Street parking/garage parking','周三','https://drive.google.com/file/d/1i02e8H-j1oQS8FNZ3qCRPqF_p96DRQZn/view?usp=drive_link','特点：有五个heater
房间：1层
空调分布：客厅/房间'),
('kellyvilleb04','kellyvile04a','KellyvilleB04',5.0,2.5,'5Q',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','电视','空调：中央空调']::text[],null,'20240707','TP-Link_B810','65592809','0 个车位 Street parking','周三','https://drive.google.com/file/d/1XDJ4YDSiFXgdJeQzdiBp1P1OTFutfkru/view?usp=sharing','特点：老板自己的房子，换了新的沙发
房间：楼上有4间卧室，楼下一间卧室，浴室在楼上，马桶在楼下
空调分布：客厅/房间
WiFi 供应商：房东'),
('kellyvillec35','kellyvillec35','KellyvilleC35',5.0,2.5,'5Q',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','洗衣机','熨斗和烫板','吸尘器','电视','空调：中央空调']::text[],null,'5387','Occom_29AF','85738270','0 个车位 garage parking','周三','https://drive.google.com/file/d/1i02e8H-j1oQS8FNZ3qCRPqF_p96DRQZn/view?usp=drive_link','特点：空调老化不太好
房间：楼下一个卧室和厕所，其余都在楼上
空调分布：客厅/房间
WiFi 供应商：澳世'),
('maraylya04','maraylya041','Maraylya04',5.0,null,'5Q',array['炉灶','烤箱','洗碗机','冰箱','微波炉','吹风机','洗衣机','熨斗和烫板','吸尘器','电视','空调：挂式空调']::text[],null,'3638','Telstra196A59','dpcwdvn9cm','0 个车位 Street parking','周三','https://drive.google.com/file/d/1i02e8H-j1oQS8FNZ3qCRPqF_p96DRQZn/view?usp=drive_link','特点：Rouse Hill 地铁站（Rouse Hill Metro Station）
📍 距离约 7.1 公里
⏱️ 驾车约 12-15 分钟

Riverstone 火车站（Riverstone Train Station）
📍 距离约 3.4 公里
⏱️ 驾车约 6-8 分钟

Box Hill Town Centre 商业中心
🛍️ 距离约 3.35 公里
⏱️ 驾车约 5-7 分钟
房间：楼上四房2卫半 楼下一房一个厕所。
空调分布：客厅/房间
WiFi 供应商：房东'),
('marsdenpark17','marsdenpark17','MarsdenPark17',4.0,2.5,'4Q',array['炉灶','烤箱','洗碗机','冰箱','微波炉','吹风机','洗衣机','熨斗和烫板','吸尘器','电视','空调：挂式空调']::text[],null,'112233#','name：Occom 9FCC, Occom 9FCC 5G','67763726
WiFi password：18681529','0 个车位 Street parking/车库不能使用','周三','https://docs.google.com/presentation/d/1u_GeX-2G3_xXAUsjBLkvA41rZn42_7u6/edit?usp=sharing&ouid=110733699984123945616&rtpof=true&sd=true','房间：楼上有4间卧室
空调分布：楼上central，楼下1台台式
WiFi 供应商：澳世'),
('penrith81','penrith101','Penrith81',3.0,2.0,'3Q',array['炉灶','烤箱','洗碗机','冰箱','微波炉','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','电视','空调：中央空调']::text[],null,'0101','OPTUS_29BC28N','peter75693nf','1 个车位 一个停车位','垃圾房在同一层','https://drive.google.com/file/d/1lnz_gKfsm19FeCTP9yAFUwfgu1ec4T_u/view?usp=sharing','特点：公寓
房间：公寓在1层
空调分布：客厅/房间
备用锁盒：Y 在旁边草丛'),
('pymble27','pymble27','Pymble27',4.0,2.5,'3q+2s；沙发床 1',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','婴儿床','电视','空调：中央空调']::text[],'wise',null,'HomeMesh','pymble2073','2 个车位 车库停车','Monday','https://drive.google.com/file/d/1bSiSBoA8uGFaFEu8SyX_EvC50Rr8Q1Np/view','房间：4 间舒适卧室（楼上 3 间，楼下 1 间）
备用锁盒：/
WiFi 供应商：房东'),
('rousehill24','rousehill24','Rousehill24',4.0,2.5,'3Q1K',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','电视','空调：中央空调']::text[],'fety',null,'EXETEL B03FDA 2.4G','uzqt9j7t','0 个车位 Garage','周四','https://drive.google.com/file/d/1trVnMd8RD3-WzamdZ91xzeJdRfRqmJat/view?usp=sharing','特点：Main door security alarm:
When people are in ：1231 stay
When people are leave: 1231 away
房间：楼上有4间卧室2间浴室+楼下厕所
空调分布：客厅/房间
WiFi 供应商：房东'),
('rousehill26','rousehill26','Rousehill26',5.0,2.5,'5Q',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','洗衣机','熨斗和烫板','吸尘器','泳池','电视','空调：中央空调']::text[],null,'258025#','TP-Link_E80D/ TP-Link_E80D_5G','15501165','0 个车位 Street parking/车库停车','周三','https://drive.google.com/file/d/1ccYLQggKUFG7Y0Bn15cquB5y3CTwnxz-/view?usp=drive_link','特点：Rouse Hill Town Centre（约5分钟车程）
Tallawong Metro Station（约6分钟车程）
房间：楼上有4间卧室，2间浴室/楼下有一间卧室带全套浴室和厕所
空调分布：客厅/房间
备用锁盒：Y 备用锁盒请看下方备注，里面有泳池的卡片，泳池不给使用了，现在只有rousehill145可以使用
WiFi 供应商：房东'),
('tallawong38','tallawong38','Tallawong38',6.0,2.5,'5Q',array['炉灶','烤箱','洗碗机','冰箱','微波炉','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','电视','空调：中央空调']::text[],null,'8819','2.4GHz: QWRT_ 84P8_2.4G 
5GHZ: QWRT_84P8_5G','84P89Ngm','0 个车位 Street parking/Garage','周五','https://drive.google.com/file/d/10sXCfwHOhBOILls1Mc1mQfwuEvlEynwQ/view?usp=sharing','特点：锁盒在挂在后院的水龙头上
房间：楼上有四间卧室（其中一间带独立浴室），两间浴室,  楼下有两间卧室，其中一间卧室是沙发床，一个厕所
空调分布：客厅/房间
WiFi 供应商：房东'),
('turramurra51','turramurra51','Turramurra 51',4.0,2.0,'4Q；沙发床 1',array['炉灶','烤箱','冰箱','微波炉','浴缸','吹风机','洗衣机','熨斗和烫板','吸尘器','电视','空调：挂式空调']::text[],null,'0051','-298ADE','50754113','Y 私人后院可以停放3-4辆车','周三','https://drive.google.com/file/d/1zeNRk8FZY_VBHscC2RJcMGrPvW01NsiC/view','空调分布：客厅/房间，房源内有风扇
WiFi 供应商：房东'),
('wahroonga181','wahroonga181','Wahroonga 181',2.0,2.0,'2 QUEEN BED',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','烘干机','洗衣机','熨斗和烫板','电视（智能）','空调：分体空调']::text[],null,'8181','181-guest','tt12345678','1 个车位 街道停车位',null,'https://drive.google.com/file/d/1K_zB9bVgpa5X_OfAR4CeIhhfY9-zQ0Db/view?usp=drive_link','空调分布：客厅一个挂式，卧室里面有吊扇，两个卧室里面有暖气
WiFi 供应商：房东'),
('waitara17','waitara17','Waitara 17',2.0,1.0,'2Q；沙发床 1',array['炉灶','烤箱','洗碗机','冰箱','微波炉','吹风机','洗衣机','熨斗和烫板','吸尘器','电视','空调：挂式空调']::text[],null,'1965','-C006SSID/WiFi-C006-5G','34453520','0 个车位 Street Parking/车库停车','周四','https://drive.google.com/file/d/1VG4ZWEhLG-qbKgJ5-Q7gxy6MBdifdI5W/view?usp=sharing','空调分布：客厅一台，卧室配有风扇和移动暖气
WiFi 供应商：房东'),
('rousehill145','rousehill145','Rousehill145',4.0,3.0,'4Q；沙发床 1',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','洗衣机','熨斗和烫板','吸尘器','泳池','电视','空调：中央空调']::text[],null,'0707',null,'15501165','0 个车位 Street parking','周三','https://drive.google.com/file/d/1sI2-ZCQlXZOdzRBX3-jDOQS7e_yetKY9/view?usp=drive_link','特点：Rouse Hill Town Centre（约5分钟车程）
Tallawong Metro Station（约6分钟车程）
房间：楼上有3间卧室，2间浴室/楼下有一间卧室带全套浴室和厕所
空调分布：客厅/房间
备用锁盒：Y
WiFi 供应商：房东'),
('burwood03','burwood03','Burwood 03',2.0,2.0,'2 Queen bed；沙发床 1',array['炉灶','洗碗机','冰箱','微波炉','浴缸','吹风机','烘干机','洗衣机','熨斗和烫板','婴儿床','电视（智能）','空调：分体空调']::text[],null,'818','TelstraC73CC0','Pin:vcn6u3xsxr','1 个车位 地下车库',null,'https://drive.google.com/file/d/1mWiioINbwyait0TwOwpw_gQnmNf-L1mX/view?usp=drive_link','特点：有婴儿床
房间：有婴儿床和高脚椅
空调分布：1台挂式客厅, 卧室有风扇和小暖气，电闸在厨房柜子里面
WiFi 供应商：房东'),
('burwoodg04','burwoodg04','Burwood G04',1.0,1.0,'1 Queen bed',array['炉灶','烤箱','冰箱','微波炉','吹风机','烘干机','洗衣机','熨斗和烫板','电视','空调：分体空调']::text[],null,'810','NetComm 2985','Zugp7bwqUvxTb4by','1 个车位 车库停车位',null,'https://docs.google.com/presentation/d/1ZEyBDXETTP7McSqOWi1CQv7HzvvutUyH/edit?slide=id.p1#slide=id.p1','特点：房东很好沟通
空调分布：中央空调'),
('burwoods1','burwoods1','Burwood S1',2.0,1.0,'2 doubel bed',array['炉灶','烤箱','电饭煲','冰箱','微波炉','吹风机','洗衣机','熨斗和烫板','空调：分体空调']::text[],'475/7507',null,'L1-W-1/L2-W-1','Nihao1234','/ 街道付费停车',null,'https://drive.google.com/file/d/193WSHhCFXQVQzDWAVD8ZJpIrAkVJUK0i/view?usp=drive_link','特点：房东自己清洁，需要随时报告清洁安排，客人如果有任何特殊要求都可以告诉房东，每个月发statement给房东
房间：客厅没有沙发和电视机
空调分布：中央空调
WiFi 供应商：房东'),
('burwoods2','burwoods2','Burwood S2',1.0,1.0,'1 double bed；沙发床 1',array['炉灶','烤箱','冰箱','微波炉','吹风机','洗衣机','熨斗和烫板','电视','空调：分体空调']::text[],'425/8819',null,'L1-W-1/L2-W-1','Nihao1234','/ 街道付费停车',null,'https://drive.google.com/file/d/1A5byAx3jcW2YNTZMQ7WqOBwJDAq6Jgd2/view?usp=drive_link','特点：房东自己清洁，需要随时报告清洁安排，客人如果有任何特殊要求都可以告诉房东，每个月发statement给房东
房间：沙发床可以拉
空调分布：中央空调
WiFi 供应商：房东'),
('burwoods6','burwoods6','Burwood S6',1.0,1.0,'1 double bed；沙发床 1',array['炉灶','烤箱','冰箱','微波炉','吹风机','洗衣机','熨斗和烫板','电视','空调：分体空调']::text[],'465/7506',null,'L1-W-1/L2-W-1','Nihao1234','/ 街道付费停车',null,'https://drive.google.com/file/d/1rTtmkpHH50WpDoOtismHeS_7ZL9Whbex/view?usp=drive_link','特点：房东自己清洁，需要随时报告清洁安排，客人如果有任何特殊要求都可以告诉房东，每个月发statement给房东
房间：沙发床可以拉， 有阳台但是共用的，阳台上有晾衣架
空调分布：中央空调
WiFi 供应商：房东'),
('cammeray08','cammeray08','Cammeray 08',1.0,1.0,'1 Queen bed
1 Single bed
1 Sofa bed；沙发床 1',array['炉灶','烤箱','冰箱','微波炉','吹风机','洗衣机','熨斗和烫板','电视（智能）','空调：挂式']::text[],null,'8819','Alchemist Espresso','LoveCammeray33','/ 街道停车',null,'https://drive.google.com/file/d/1Pmpm2Z72RCHR0OAJ45-PIfmpnR4WLnVd/view','特点：每天楼下两杯免费咖啡，毛巾楼下可以随时送
房间：备用毯子在单人床的柜子下面
空调分布：客厅挂式空调
WiFi 供应商：房东'),
('canterbury521','canterbury521','Canterbury 521',2.0,2.0,'2 queen bed
2 sofa bed；沙发床 2',array['炉灶','烤箱','洗碗机','冰箱','微波炉','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','电视（智能）','空调：分体空调']::text[],null,'1314','0ccom-A0B8-2.4G/0ccom-A0B8-5G','g2eyqry?et','1 个车位 地下停车位',null,'https://drive.google.com/file/d/1KwBUYem3T2XMaC9dLJm5mqeMKFeB6ekN/view?usp=drive_link','空调分布：中央空调
WiFi 供应商：房东'),
('chatswood219','chatswood219','Chatswood 219',1.0,1.0,'1 king bed
1 sofa bed；沙发床 1',array['炉灶','烤箱','洗碗机','冰箱','微波炉','吹风机','烘干机','洗衣机','熨斗和烫板','电视（智能）','空调：分体空调']::text[],null,'0714','Silkari Guest Access','不需要密码','1 个车位 周边付费停车',null,'https://drive.google.com/file/d/16i7a0MYcCw5-opy0h3gIg0PgiVFPCLQV/view?usp=drive_link','特点：房东就在旁边，清洁以及维修等问题房东可以随时解决
空调分布：中央空调'),
('hurstville108b','hurstville108b','Hurstville 108B',3.0,2.0,'3 queen bed',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','泳池','电视（智能）']::text[],null,'1314','Occom_BF58','30314078','1 个车位 underground parking',null,'https://drive.google.com/file/d/1NeUSIDoMSyzYCWQnHvTvmHFnKgPbrJXG/view?usp=sharing','空调分布：中央空调
WiFi 供应商：澳世'),
('hurstvill10','hurstvill10','Hurstvill 10',1.0,1.0,'1q；沙发床 1',array['炉灶','烤箱','洗碗机','冰箱','微波炉','吹风机','烘干机','洗衣机','熨斗和烫板','电视（智能）','空调：挂式空调']::text[],null,'9910',null,null,'1 个车位 Lot number AG10,It''s one level up from the entrance and drive to the end','垃圾房在同一层','https://drive.google.com/file/d/1XVXEZSX03oV2SCul8HQIgIj55nKBAqHT/view?usp=sharing','特点：距离 Hurstville火车站 步行仅约5分钟，交通非常便利，乘坐火车到悉尼市中心约20分钟
空调分布：两台壁挂式空调  房间卧室各一台
备用锁盒：COCO不知道'),
('leichhardt27a','leichhardt27a','Leichhardt 27A',3.0,3.0,'4',array['炉灶','烤箱','洗碗机','冰箱','微波炉','吹风机','烘干机','洗衣机','熨斗和烫板','电视（智能）','空调：中央']::text[],null,'2728',null,null,'1 个车位 街边停车，但是基本没有','垃圾房在楼下门口','https://drive.google.com/file/d/1-rTcU9IA1TmbR7jm06e1nHhRMgTRV_aV/view?usp=drive_link','特点：没有停车位
空调分布：中央空调
备用锁盒：COCO不知道'),
('canterbury129','canterbury129','Canterbury 129',2.0,2.0,'2 queen bed
1 sofa bed；沙发床 2',array['炉灶','烤箱','洗碗机','冰箱','微波炉','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','电视（智能）','空调：分体空调']::text[],null,'1314','Occom_69AC','g2eyqry?et','1 个车位 地下停车位',null,'https://drive.google.com/file/d/1KwBUYem3T2XMaC9dLJm5mqeMKFeB6ekN/view?usp=drive_link','空调分布：中央空调
WiFi 供应商：房东'),
('hurstville32','hurstville32','Hurstville 32',2.0,1.0,'2Q',array['炉灶','烤箱','冰箱','微波炉','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','电视（智能）','空调：中央空调']::text[],null,'5115','eeroL2lounge','14260148','街边停车 街边停车','周四','https://drive.google.com/file/d/19i6GTf8BX2ZtM8ctdgZheq7EankYRcdQ/view?usp','特点：Hurstville32 是奶奶房，网络设在主house，是由信号连接器供网
房间：平层只有两间卧室和一间浴室 卧室1：一张双人床，卧室2：一张双人床
空调分布：中央空调
备用锁盒：有 在hurstvill 05
WiFi 供应商：澳世'),
('arcadia24','arcadia24','Arcadia 24',5.0,2.5,'5 Queen Beds；沙发床 1',array['炉灶','烤箱','洗碗机','电饭煲','冰箱','微波炉','浴缸','吹风机','洗衣机','熨斗和烫板','吸尘器','婴儿床','高脚凳','泳池','电视（智能/有线）','空调：分体空调']::text[],null,'8819','Occom _A3AB / Occom_ A3AB_5G','06774288','1 个车位 车库不可用/ Street parking3辆以上','周天','https://drive.google.com/file/d/1TTdWE3EyINO2eyENAJtcqZDv8I6uvnYB/view?usp=share_link','特点：农场，有很大的草坪，可以办婚礼/30个人
房间：房间1：大号床 房间2：大号床 房间3：大号床 房间4：大号床 房间5：大号床 附加：1张沙发床。
空调分布：三个卧室和客厅 有空调，另外2个卧室没有/ 其余配风扇
备用锁盒：不确定 问Alisa
WiFi 供应商：奥世'),
('barangaroo19f','barangaroo19f','Barangaroo19F',2.0,2.0,'2Queen；沙发床 1',array['炉灶','烤箱','洗碗机','冰箱','微波炉','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','泳池','健身房','电视（智能）','空调：中央空调']::text[],'人工配送',null,null,null,'0 个车位 附近停车场🅿️ Barangaroo Reserve Car Park（Wilson Parking）
地址：5 Towns Place, Barangaroo NSW 2000

距离：步行约 10 分钟

车位：约 300 个，设有无障碍车位

开放时间：每天 6:00 AM 至午夜 12:00 AM',null,'https://drive.google.com/file/d/1NnBBoXFT46ZAlVCzgBHVKLmLGmZx6J5k/view?usp=drive_link','特点：送钥匙 可以看见海港大桥 高端公寓
房间：房间1：一张双人床 房间2：一张双人床 客厅：一张沙发床
空调分布：全屋中央空调 智能控制面板在墙上
备用锁盒：待确认
WiFi 供应商：房东'),
('barangaroo21b','barangaroo21b','Barangaroo21B',1.0,1.0,'1Queen 1Single',array['炉灶','烤箱','洗碗机','冰箱','微波炉','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','泳池','健身房','电视（智能）','空调：中央空调']::text[],'人工配送',null,'TPW4G_BWD4UZ','8747458574','0 个车位 附近停车场🅿️ Barangaroo Reserve Car Park（Wilson Parking）
地址：5 Towns Place, Barangaroo NSW 2000

距离：步行约 10 分钟

车位：约 300 个，设有无障碍车位

开放时间：每天 6:00 AM 至午夜 12:00 AM',null,'https://drive.google.com/file/d/1-MDUAZvjmFQ1MFVOFuVx9XVADWBVeCyk/view?usp=drive_link','特点：送钥匙 可以看见海港大桥
房间：房间1：一张双人床 房间2：由书房改造的卧室 一张单人床
空调分布：全屋中央空调 智能控制面板在墙上
备用锁盒：车库9898/8922
WiFi 供应商：房东'),
('barangaroo30','barangaroo30','Barangaroo30',3.0,2.5,'3Queen',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','泳池','健身房','电视（智能）','空调：中央空调']::text[],'人工配送',null,'name：NOKIA-C540','F3Rt7vbdJG','2 个车位 underground parking',null,'https://drive.google.com/file/d/10Hmn_bjRbeMVMsQtoSuvcE2gRXWSfU0T/view?usp=drive_link','特点：可以看见海港大桥
房间：房间1：双人床 房间2：双人床 房间3：双人床
空调分布：全屋中央
备用锁盒：Y 车库9898/8922'),
('barangaroo10d','barangroo10d','Barangaroo10D',3.0,2.5,'3Queen；沙发床 1',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','婴儿床','泳池','健身房','电视（智能）','空调：中央空调']::text[],'人工配送',null,'Occom5196','a6ес?6wyrp','2 个车位 underground parking',null,'https://drive.google.com/file/d/1gK-o1hweYy5HKNbfFCRs8ZIgyL1gxV9I/view?usp=drive_link','特点：风景很好，可以看海
房间：房间1：一张双人床 房间2：一张双人床 房间3：一张双人床  附加：1张沙发床
空调分布：全屋中央空调
备用锁盒：Y 车库9898/8922
WiFi 供应商：奥世'),
('baulkhamhill42','baulkhamhills42','Baulkham hill 42',4.0,3.5,'2q4s',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','婴儿床','泳池','电视（智能/有线）','空调：中央空调']::text[],null,'117117','TP-Link_F339','49KWN93aKVMBjXe','2 个车位 Garage（2） / Street parking，','Tuesday','https://drive.google.com/file/d/1J8P_AQOTe-A3g5RMS8dob_Q0b39RZJYE/view?usp=drive_link','特点：公园BBQ/网球场/大绿地/古董房/保险客户多
房间：房间1：大号床带浴室（楼下） 房间2：主人套房大号床带浴室（楼上） 房间 3：2 张单人床（楼上） 房间 4：2 张单人床（楼上） 另外1间全套浴室和独立厕所（楼上）
空调分布：目前还有三台风扇
备用锁盒：Y Digital locker pin: 117117/ Spare key locker pin: 1130
WiFi 供应商：房东'),
('greenwich33','greenwich33','Greenwich33',6.0,3.0,'6Queen',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','洗衣机','熨斗和烫板','吸尘器','泳池','健身房','电视（智能）','空调：中央空调']::text[],null,'8819','Occom_FE81','19686080','2 个车位 garage2辆 街边可以停','周日','https://drive.google.com/file/d/17nZ9SwBwmtXZmDkoMMZZj13ehPbNW2ce/view?usp=drive_link','特点：位置很好，距离悉尼歌剧院不远
房间：房间1：一张双人床 房间2：一张双人床 房间3：一张双人床 房间4：一张双人床 房间5：一张双人床
空调分布：两个卧室和客厅配有空调，其他房间有风扇
备用锁盒：Y 备用锁盒在房门的过道的水管处，密码是0707'),
('liverpool305','liverpool305','Liverpool305',3.0,2.0,'3Queen；沙发床 1',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','电视（智能）','空调：挂式空调']::text[],'mailbox：618
lockbox：2838',null,'Name：TP-Link_9549_5G','74937318','2 个车位 underground parking',null,'https://drive.google.com/file/d/12Q-T018IAmIZzC1duZMiVArDCscl1KVw/view?usp=sharing','特点：可以住8人
房间：房间1：一张双人床 房间2：一张双人床 房间3：一张双人床 附加：1张沙发床。
空调分布：客厅有空调，卧室有风扇。2台风扇，2台暖气。
备用锁盒：Y 邮箱边上的路边红色箱子消防栓上（被偷之后不确定）'),
('northbondi126','northbondi126','North Bondi126',4.0,1.5,'3Queen 2Single',array['炉灶','烤箱','洗碗机','冰箱','微波炉','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','电视（智能）','空调：挂式空调']::text[],null,'0126','NetComm 9426','YDZ6TWJt8MF4X2SD','1 个车位 街边停车',null,'https://drive.google.com/file/d/1l_r2BHp8fIn2clQS1o3VoEEw1NtnyY57/view?usp=drive_link','特点：靠近Bondi海滩
房间：房间1：一张双人床 房间2：一张双人床 房间3：一张双人床 房间4：Bunk bed
空调分布：客厅有空调，卧室有风扇
备用锁盒：待确认'),
('nulkaba356','nulkaba356','Nulkaba356',4.0,2.0,null,array['炉灶','烤箱','洗碗机','冰箱','微波炉','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','电视（智能）','空调：挂式空调']::text[],null,null,'Name：356 Tuckers Ln','1234567Aa','房子前 In front of the house',null,'https://drive.google.com/file/d/1rTG3Jqht550jcQ4tI1qhu_MaZoZ8IteJ/view?usp=drive_link','特点：Sandalwood Vine Resort: Gate Access Code: 6283
The Piano House: Code Lock: 628300 Cellar Door(Free now):258220
房间：房间1：一张双人床 一张king bed 一张bunk bed 房间2：一张双人床 房间3：一张king bed 房间4：1张沙发床
空调分布：不确定'),
('nulkaba72','nulkaba72','Nulkaba72',5.0,2.5,'5Queen',array['炉灶','烤箱','洗碗机','电饭煲','冰箱','微波炉','浴缸','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','电视（智能）','空调：挂式空调']::text[],null,'2719','Name：TP-Link_9549_5G','74937318','2 个车位 Driveway',null,'https://drive.google.com/file/d/1zQ7P2vKn8PBOs2k1NLiaZE0JvJIM7c9Q/view','特点：Gate code: SPELL
The password for the middle door:8090房东人很好，很大草地，邻居帮忙做清洁
房间：房间1：一张双人床 房间2：一张双人床 房间3：一张双人床   房间4：一张双人床 房间5：一张双人床
空调分布：ducted air conditioning, 不确定所有房间都有，还在核对'),
('putney166','putney166','Putney166',10.0,6.0,'10Queen',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','洗衣机','熨斗和烫板','吸尘器','婴儿床','高脚凳','泳池','电视（智能）','空调：VRV系统']::text[],null,null,'Name：dlink-EC5B','fexbu33433','4 个车位 garage和street parking',null,'https://drive.google.com/file/d/1kQbLgH5OUHKkjsKdURBT3adBFUrAAXav/view?usp=share_link','特点：Code for pool part:8818
Code for garden: 1988
房间：房间1：一张双人床 房间2：一张双人床 房间3：一张双人床 2间主卧，配备2米宽双人床和套内套房。 7间超大房间，配有标准双人床。（有些带套房） 1间带双人床的客房 泳池部分：负层有一个房间，一楼有一个房间，二楼有三个房间 花园部分：一楼有2个房间，二楼有3个房间
空调分布：空调VRV系统，独立供暖和制冷全功能'),
('pyrmont240','pyrmont240','Pyrmont240',1.0,1.0,'1Queen；沙发床 1',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','婴儿床','泳池','健身房','电视（智能）','空调：中央空调']::text[],null,'0717','Vodafone2.4G','6fRyyt9FegadJR3E','0 个车位 无',null,'https://drive.google.com/file/d/1XlOf91jkZz_-2b_J6b_Y6L8L1O_NyLau/view?usp=drive_link','特点：CBD 房源虽老旧但是位置很好
房间：房间1：一张双人床 附加：1张沙发床
空调分布：全屋，还额外有一个风扇'),
('tarenpoint56a','tarenpoint56a','Taren Point 56A',5.0,3.0,'6Queen；沙发床 1',array['炉灶','烤箱','洗碗机','冰箱','微波炉','浴缸','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','婴儿床','电视（智能）','空调：中央空调']::text[],null,'0707','TP_LINK_A6C3','31124065Wx','4 个车位 车库和路边都可以',null,'https://drive.google.com/file/d/1ejYRiBLoPTela5Dm9AntVQRmUksjgTaQ/view?usp=drive_link','特点：豪宅，出门就是海。
房间：房间1：一张King，一张婴儿车 房间2：1张King 房间3：两张queen 房间4：一张queen 房间5：一张queen  附加：1张沙发床
空调分布：全屋中央'),
('ultimo105','ultimo105','Ultimo105',3.0,2.0,'4Queen',array['炉灶','烤箱','冰箱','微波炉','吹风机','烘干机','洗衣机','熨斗和烫板','吸尘器','婴儿床','电视（智能）','空调：Y']::text[],null,'1029','-FCDBD6','71653556','1 个车位 underground parking',null,'https://drive.google.com/file/d/1Nlg-MiYx0tu2JidLbfZ_9cj5yM6DjlN0/view?usp=drive_link','特点：房源比较老，位置很好，靠近cbd和大学。
房间：房间1：两张双人床 房间2：一张双人床 房间3：一张双人床
空调分布：两个房间有空调/小房间有heater');

create temp table _m as
select distinct on (i.k1) i.*, p.id as pid
  from _info i join public.properties p
    on lower(regexp_replace(p.name,'[^a-zA-Z0-9]','','g')) in (i.k1, i.k2)
 order by i.k1, p.id;

insert into public.property_details(property_id) select pid from _m on conflict (property_id) do nothing;

update public.property_details d set
  bedrooms      = coalesce(d.bedrooms, m.bedrooms::int),
  bathrooms     = coalesce(d.bathrooms, m.bathrooms),
  beds          = coalesce(nullif(d.beds,''), m.beds),
  appliances    = case when coalesce(array_length(d.appliances,1),0) = 0 then m.appliances else d.appliances end,
  lock_location = coalesce(nullif(d.lock_location,''), m.lock_location),
  lock_code     = coalesce(nullif(d.lock_code,''), m.lock_code),
  wifi_name     = coalesce(nullif(d.wifi_name,''), m.wifi_name),
  wifi_password = coalesce(nullif(d.wifi_password,''), m.wifi_password),
  parking       = coalesce(nullif(d.parking,''), m.parking),
  bin_day       = coalesce(nullif(d.bin_day,''), m.bin_day),
  guidebook_url = coalesce(nullif(d.guidebook_url,''), m.guidebook),
  notes         = coalesce(nullif(d.notes,''), m.notes)
from _m m where d.property_id = m.pid;

-- Becky 和 Qily 已离职，她们的房源先全部记到 zoe 名下
update public.properties p set assistant_id = (select id from public.profiles where account = 'zoe' limit 1)
 where (select id from public.profiles where account = 'zoe' limit 1) is not null
   and lower(regexp_replace(p.name,'[^a-zA-Z0-9]','','g')) in ('botany109b','botany407a','boxhill02','boxhill07','cadens03','carlingford36','castlehill01','castlehill83','collary51','daystreet188','gable07grannyflat','haymarket801','hornsby02','jordanspring10','kellyville01','kellyvilleb04','kellyvillec35','maraylya04','marrickville01','marrickville02','marrickville03','marrickville04','marrickville05','marrickville06','marsdenpark17','mascot17','penrith81','pymble27','pyrmont216','pyrmont715','redfern302','rosebery305','rousehill145','rousehill24','rousehill26','shelley410','sydney1306','tallawong38','turramurra51','wahroonga181','waitara17','waterloo311','zetland126');

-- 结果：导入了几个，哪些个体表在系统里找不到同名房源
select (select count(*) from _m) as 已导入房源数, (select count(*) from _info) as 个体表数;
select i.label as 个体表里的房源名 from _info i where not exists (select 1 from _m m where m.k1 = i.k1) order by 1;
