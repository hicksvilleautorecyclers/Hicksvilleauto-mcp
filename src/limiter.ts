/** Bounded process-local load guard. No IPs, user IDs or prompts retained. */
export class ReadLimiter {
  private since=0;private count=0;private active=0;
  constructor(private readonly clock=()=>Date.now(),private readonly perMinute=240,private readonly simultaneous=8){}
  acquire():null|(()=>void){
    const now=this.clock();if(now-this.since>=60000){this.since=now;this.count=0;}
    if(this.count>=this.perMinute||this.active>=this.simultaneous)return null;
    this.count++;this.active++;let released=false;
    return ()=>{if(!released){released=true;this.active--;}};
  }
}
