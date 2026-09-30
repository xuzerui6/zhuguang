"use client";

import { ArrowRight, BadgeCheck, CalendarCheck2, Check, MapPin, MessagesSquare, Search, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { TRAINING_GOAL_OPTIONS } from '../../shared/coach-catalog';
import { cityName, resolveServiceCity, SERVICE_CITIES, type ServiceCityId } from '../../shared/service-cities';
import type { ServiceCatalog } from '../../shared/service-catalog';
import type { MobileCoach } from '../mobile/types';
import { HomeCityController, homeCityUrl, homeTrialPrice, type HomeCityData } from '../_lib/home-city-state';
import { mapMobileCoachToWeb } from '../_lib/web-platform';
import { platformRequest } from './platform-client';
import { CoachSpotlightCarousel } from './coach-spotlight-carousel';
import { ServiceLeadForm } from './service-lead-form';
import { PublicHeader } from './public-header';
import styles from './public-site.module.css';

type CityContext = ReturnType<HomeCityController['getSnapshot']> & {
  changeCity: (city: ServiceCityId) => void;
  retry: () => void;
  coachId?: number;
  notice: string;
};
const HomeCityContext = createContext<CityContext | null>(null);
function useHomeCity() {
  const context = useContext(HomeCityContext);
  if (!context) throw new Error('Home city provider is required');
  return context;
}

export function HomeCityProvider({ initial, initialCoachId, children }: { initial: HomeCityData; initialCoachId?: number; children: ReactNode }) {
  const [controller] = useState(() => new HomeCityController(initial, async cityId => {
    const [coaches, catalog] = await Promise.all([
      platformRequest<MobileCoach[]>(`/api/v1/coaches?city=${cityId}`),
      platformRequest<ServiceCatalog>(`/api/v1/catalog?city=${cityId}`),
    ]);
    if (catalog.city !== cityName(cityId)) throw new Error('City catalog mismatch');
    return { cityId, coaches: coaches.map(mapMobileCoachToWeb).filter(coach => coach.profileKind === 'real'), catalog };
  }));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [coachId, setCoachId] = useState(initialCoachId);
  const [notice, setNotice] = useState('');
  const retryCity = useRef(initial.cityId);
  const change = useCallback(async (city: ServiceCityId, fromHistory = false) => {
    retryCity.current = city;
    const requestedCoach = Number(new URL(window.location.href).searchParams.get('coach')) || undefined;
    const succeeded = await controller.load(city);
    const latest = controller.getSnapshot();
    if (!succeeded) {
      if (fromHistory && latest.error) window.history.replaceState(window.history.state, '', homeCityUrl(new URL(window.location.href), latest.data.cityId, latest.data.coaches.map(coach => coach.id)));
      return;
    }
    const ids = latest.data.coaches.filter(coach => coach.canConsult).map(coach => coach.id);
    const nextCoach = requestedCoach && ids.includes(requestedCoach) ? requestedCoach : undefined;
    setCoachId(nextCoach);
    setNotice(requestedCoach && !nextCoach ? '原教练不在当前城市提供服务，已保留你的联系方式和训练需求。' : `已切换至${cityName(city)}，教练与价格已更新。`);
    const url = homeCityUrl(new URL(window.location.href), city, ids);
    if (fromHistory) window.history.replaceState(window.history.state, '', url);
    else if (url !== window.location.pathname + window.location.search + window.location.hash) window.history.pushState(window.history.state, '', url);
  }, [controller]);
  useEffect(() => {
    const restore = () => { void change(resolveServiceCity(new URL(window.location.href).searchParams.get('city')), true); };
    window.addEventListener('popstate', restore);
    return () => { controller.cancel(); window.removeEventListener('popstate', restore); };
  }, [change, controller]);
  return <HomeCityContext.Provider value={{ ...state, coachId, notice, changeCity: city => { void change(city); }, retry: () => { void change(retryCity.current); } }}>{children}</HomeCityContext.Provider>;
}

export function HomeHeroCopy() {
  const { data } = useHomeCity();
  const price = homeTrialPrice(data.coaches);
  return <div className={styles.heroCopy}>
    <p className={styles.heroKicker}>服务北京 · 吉林长春</p>
    <h1>专业体育教练<br />先核验，再预约</h1>
    <p>为中考体育、专项提升和体能训练匹配已审核教练。<span className={styles.homeCityFade} key={data.cityId}>{data.cityId === 'changchun' ? '长春训练地点由学员与教练协商。' : '可选合作场馆或协商训练地点。'}{price === undefined ? '教练确认后预约生效，训练费用线下支付。' : `${cityName(data.cityId)}首次试课 ¥${price}/60分钟起，教练确认后预约生效。`}</span></p>
    <div className={styles.heroActions}><HomeCityLink href="/coaches">找教练 <ArrowRight aria-hidden size={18} /></HomeCityLink><Link href="#service-inquiry">先咨询训练需求 <MessagesSquare aria-hidden size={18} /></Link></div>
    <div className={styles.heroTrust} aria-label="平台服务原则"><span><BadgeCheck aria-hidden size={18} />人工核验</span><span><CalendarCheck2 aria-hidden size={18} />确认后生效</span><span><ShieldCheck aria-hidden size={18} />隐私保护</span></div>
  </div>;
}

export function HomePublicHeader() {
  const { data } = useHomeCity();
  return <PublicHeader cityId={data.cityId} />;
}

export function HomeSearchBand() {
  const { data, pendingCity, error, notice, changeCity, retry } = useHomeCity();
  const [selection, setSelection] = useState({ cityId: data.cityId, sport: '' });
  const validSport = data.catalog.sports.some(item => item.name === selection.sport && item.available !== false && item.coachCount !== 0) ? selection.sport : '';
  if (selection.cityId !== data.cityId) setSelection({ cityId: data.cityId, sport: validSport });
  const status = pendingCity ? `正在切换至${cityName(pendingCity)}，当前内容暂时保留。` : error || notice;
  return <section className={styles.discoveryBand} aria-labelledby="find-title">
    <div><p className="zg-eyebrow">从真实需求出发</p><h2 id="find-title">先说明你要练什么</h2></div>
    <div><form action="/coaches" className={styles.searchPanel} aria-busy={Boolean(pendingCity)}>
      <label><span>城市</span><select value={pendingCity || data.cityId} onChange={event => changeCity(resolveServiceCity(event.target.value))} name="city" aria-label="选择城市">{SERVICE_CITIES.map(city => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label>
      <label><span>项目</span><select value={validSport} onChange={event => setSelection({ cityId: data.cityId, sport: event.target.value })} name="sport" aria-label="选择运动项目"><option value="">全部已上线项目</option>{data.catalog.sports.filter(item => item.available !== false && item.coachCount !== 0).map(item => <option key={item.id}>{item.name}</option>)}</select></label>
      <label><span>目标</span><select defaultValue="中考体育" name="goal" aria-label="选择训练目标">{TRAINING_GOAL_OPTIONS.map(goal => <option key={goal}>{goal}</option>)}</select></label>
      <button disabled={Boolean(pendingCity)} type="submit"><Search aria-hidden size={18} />查看匹配结果</button>
    </form><div className={styles.homeCityStatus} role="status" aria-live="polite">{status}{error ? <button onClick={retry} type="button">重试切换</button> : null}</div></div>
  </section>;
}

export function HomeSpotlight() {
  const { data, pendingCity } = useHomeCity();
  const coaches = data.coaches.slice(0, 3);
  return <section className={styles.spotlightSection} aria-busy={Boolean(pendingCity)}>
    <div className={styles.spotlightHeading}><div><p className="zg-eyebrow">{cityName(data.cityId)} · 真实教练</p><h2 className="zg-section-title">{cityName(data.cityId)}已核验教练</h2></div><p>平台只展示已经提供并可核验的信息。没有评价、课量或经营数据时，会如实说明。</p></div>
    <div className={styles.homeCoachFade} key={data.cityId}>
      {coaches.length ? <CoachSpotlightCarousel count={coaches.length}>
        {coaches.map(coach => <article className={styles.spotlightCard} key={coach.id}>
          <HomeCityLink className={styles.spotlightCardMedia} href={`/coaches/${coach.id}`}><Image alt={`${coach.name}教练`} fill sizes="(max-width: 760px) 82vw, (max-width: 1100px) 46vw, 31vw" src={coach.media.cardUrl || coach.image} unoptimized /><span><BadgeCheck aria-hidden size={15} />{coach.verificationLabel}</span></HomeCityLink>
          <div className={styles.spotlightCardBody}>
            <div className={styles.spotlightCardIdentity}><div><h3>{coach.name}</h3><p>{coach.title}</p></div><strong>{coach.experience}年<small>执教</small></strong></div>
            <p className={styles.coachLocation}><MapPin aria-hidden size={16} />{cityName(data.cityId)} · {coach.serviceAreas?.filter(area => area.cityId === data.cityId).map(area => area.district).join('、') || coach.district}</p>
            <p className={styles.spotlightHonor}>{coach.honors.slice(0, 2).join(' · ')}</p>
            <div className={styles.coachStrengths}>{coach.strengths.slice(0, 3).map(item => <span key={item}><Check aria-hidden size={14} />{item}</span>)}</div>
            <div className={styles.coachDecision}><span><small>适合</small><strong>{coach.audience.slice(0, 2).join('、')}</strong></span><span><small>时间</small><strong>学员指定 · 教练确认</strong></span></div>
            <div className={styles.spotlightCardFooter}><span><small>常规课</small><strong>{coach.price === undefined ? '待发布' : `¥${coach.price}`}</strong></span><span><small>试课</small><strong>{coach.trialPrice === undefined ? '待发布' : `¥${coach.trialPrice}`}</strong></span><div className={styles.spotlightCardActions}><HomeCityLink href={`/coaches/${coach.id}`}>查看详情</HomeCityLink>{coach.canConsult ? <HomeCityLink href={`/?coach=${coach.id}#service-inquiry`}>咨询这位教练</HomeCityLink> : null}</div></div>
          </div>
        </article>)}
      </CoachSpotlightCarousel> : <div className={styles.homeSupplyEmpty}><strong>{cityName(data.cityId)}暂无已上线教练</strong><p>你可以先咨询训练需求，或选择其他服务城市。</p><Link href="#service-inquiry">咨询训练需求</Link></div>}
    </div>
  </section>;
}

export function HomeInquiryForm({ siteKey }: { siteKey?: string }) {
  const { data, coachId } = useHomeCity();
  const coach = data.coaches.find(item => item.id === coachId && item.canConsult);
  return <ServiceLeadForm cityId={data.cityId} coach={coach ? { id: coach.id, name: coach.name, sport: coach.sport } : undefined} siteKey={siteKey} />;
}

export function HomeCityLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const { data } = useHomeCity();
  const url = new URL(href, 'https://local.invalid');
  url.searchParams.set('city', data.cityId);
  return <Link className={className} href={url.pathname + url.search + url.hash}>{children}</Link>;
}
