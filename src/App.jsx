import { useCallback, useEffect, useRef, useState } from 'react'
import botImage from './assets/bot.png'
import logoImage from './assets/logo.png'
import './App.css'

const initialFormData = {
  email: '',
  name: '',
  whatsapp: '',
  expectations: '',
  selectionReason: '',
  referrer: '',
  proficiency: '',
  enrolmentChoice: '',
  trainedBefore: '',
  dailyHours: '',
  paymentChoice: '',
  paymentMethod: 'card',
  cardHolderName: '',
  cardNumber: '',
  cardExpiry: '',
  cardCvv: '',
  transferType: 'bank_transfer',
}

const API_BASE_URL = 'https://nextgenforgebackend.onrender.com'
const PAYMENT_SESSION_KEY = 'nextgenforge_payment_session'
const USD_TO_NAIRA_RATE = 1400
const E164_PHONE_REGEX = /^\+[1-9]\d{7,14}$/

function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [currentStep, setCurrentStep] = useState(1)
  const [isMobile, setIsMobile] = useState(false)
  const [mobileStarted, setMobileStarted] = useState(false)
  const [formData, setFormData] = useState(initialFormData)
  const [paymentError, setPaymentError] = useState('')
  const [isPaystackProcessing, setIsPaystackProcessing] = useState(false)
  const [emailCheckStatus, setEmailCheckStatus] = useState('idle')
  const [emailCheckMessage, setEmailCheckMessage] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentStatusMessage, setPaymentStatusMessage] = useState('')
  const [finalizationNotice, setFinalizationNotice] = useState('')
  const hasRestoredPaymentSessionRef = useRef(false)
  const autoCheckedCallbackReferenceRef = useRef('')

  const getPaymentOptionFromChoice = useCallback((paymentChoice) => {
    if (paymentChoice === 'installment') {
      return 'installment'
    }
    if (paymentChoice === 'team') {
      return 'team'
    }
    return 'full'
  }, [])

  useEffect(() => {
    const finishLoading = () => {
      window.setTimeout(() => setIsLoading(false), 2200)
    }

    if (document.readyState === 'complete') {
      finishLoading()
      return undefined
    }

    window.addEventListener('load', finishLoading, { once: true })

    return () => {
      window.removeEventListener('load', finishLoading)
    }
  }, [])

  const getPaymentAmountUsdByChoice = (paymentChoice) => {
    if (paymentChoice === 'installment') {
      return 30
    }
    if (paymentChoice === 'team') {
      return 120
    }
    return 50
  }

  const buildPayloadSnapshot = (data) => {
    const paymentAmountUsd = getPaymentAmountUsdByChoice(data.paymentChoice)
    const paymentAmountNaira = paymentAmountUsd * USD_TO_NAIRA_RATE
    return {
      ...data,
      paymentAmountUsd,
      paymentAmountNaira,
      paymentRate: USD_TO_NAIRA_RATE,
    }
  }

  const logPayload = (tag, data) => {
    console.log(`[Payload] ${tag}:`, buildPayloadSnapshot(data))
  }

  const handleFieldChange = (event) => {
    const { name, value } = event.target
    setFormData((previous) => {
      const nextData = { ...previous, [name]: value }
      logPayload(`field_change:${name}`, nextData)
      return nextData
    })
  }

  const getPaymentOption = useCallback(() => {
    return getPaymentOptionFromChoice(formData.paymentChoice)
  }, [formData.paymentChoice, getPaymentOptionFromChoice])

  const getPaymentAmountUsd = () => getPaymentAmountUsdByChoice(formData.paymentChoice)

  const getPaymentAmountNaira = () => {
    return getPaymentAmountUsd() * USD_TO_NAIRA_RATE
  }

  const formatNairaAmount = (amount) => amount.toLocaleString('en-NG')

  const persistPaymentSession = (reference = '') => {
    const snapshot = {
      currentStep: 4,
      mobileStarted,
      formData,
      paymentReference: reference,
      createdAt: Date.now(),
    }
    window.localStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify(snapshot))
  }

  const clearPaymentSession = () => {
    window.localStorage.removeItem(PAYMENT_SESSION_KEY)
  }

  const submitQuestionnaire = useCallback(async (submissionData = formData) => {
    const payload = {
      email: submissionData.email,
      fullName: submissionData.name,
      whatsappNumber: submissionData.whatsapp,
      expectations: submissionData.expectations,
      whySelected: submissionData.selectionReason,
      referredBy: submissionData.referrer,
      proficiencyLevel: submissionData.proficiency,
      activeEnrollment: submissionData.enrolmentChoice === 'yes',
      trainedOnAgenticPlatform: submissionData.trainedBefore,
      dailyCommitHours: submissionData.dailyHours,
      paymentOption: getPaymentOptionFromChoice(submissionData.paymentChoice),
      paymentMethod: submissionData.paymentMethod,
      paymentMeta:
        submissionData.paymentMethod === 'card'
          ? {
              cardInitialized: true,
            }
          : {
              transferType: submissionData.transferType,
            },
      source: 'landing_page',
    }
    console.log('Questionnaire payload:', payload)

    const response = await fetch(`${API_BASE_URL}/api/questionnaires`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error('Submission failed')
    }
  }, [formData, getPaymentOptionFromChoice])

  const finalizeSubmission = useCallback(async (submissionData = formData) => {
    const retryDelaysMs = [0, 1200, 2400]
    try {
      setIsPaystackProcessing(true)
      setPaymentError('')
      setFinalizationNotice('')
      clearPaymentSession()
      setCurrentStep(5)

      let submitted = false
      for (let attempt = 0; attempt < retryDelaysMs.length; attempt += 1) {
        const delay = retryDelaysMs[attempt]
        if (delay > 0) {
          await waitFor(delay)
        }
        try {
          await submitQuestionnaire(submissionData)
          submitted = true
          break
        } catch {
          // Retry a couple of times before showing a non-blocking notice.
        }
      }

      if (!submitted) {
        setFinalizationNotice('Payment was successful. We are still syncing your registration details; our team will follow up if needed.')
      }
    } catch {
      setFinalizationNotice('Payment was successful. We are still syncing your registration details; our team will follow up if needed.')
    } finally {
      setIsPaystackProcessing(false)
    }
  }, [formData, submitQuestionnaire])

  const isPaymentSuccessful = (response) => {
    const statusValue = String(
      response?.data?.payment?.status ??
        response?.status ??
        response?.data?.status ??
        response?.paymentStatus ??
        response?.data?.paymentStatus ??
        '',
    ).toLowerCase()
    const successfulStatuses = ['success', 'successful', 'completed', 'paid']
    return Boolean(
      response?.paid === true ||
        response?.data?.paid === true ||
        response?.data?.payment?.paid === true ||
        successfulStatuses.includes(statusValue),
    )
  }

  const waitFor = (delayMs) => new Promise((resolve) => window.setTimeout(resolve, delayMs))

  const checkPaymentStatusAndFinalize = useCallback(async (referenceToCheck, submissionData = formData) => {
    if (!referenceToCheck) {
      setPaymentError('Missing payment reference. Initialize payment first.')
      return
    }

    try {
      setIsPaystackProcessing(true)
      setPaymentError('')
      const retryDelaysMs = [0, 2000, 4000]
      let hadStatusCheckError = false

      for (let attempt = 0; attempt < retryDelaysMs.length; attempt += 1) {
        const delay = retryDelaysMs[attempt]
        if (delay > 0) {
          setPaymentStatusMessage('Checking payment confirmation...')
          await waitFor(delay)
        }

        try {
          const response = await fetch(`${API_BASE_URL}/api/payments/${encodeURIComponent(referenceToCheck)}`)
          if (!response.ok) {
            hadStatusCheckError = true
            continue
          }

          const statusResult = await response.json()
          if (isPaymentSuccessful(statusResult)) {
            setPaymentStatusMessage('Payment confirmed. Finalizing submission...')
            await finalizeSubmission(submissionData)
            return
          }
        } catch {
          hadStatusCheckError = true
        }
      }

      if (hadStatusCheckError) {
        setPaymentError('Unable to verify payment right now. Please try again.')
        setIsPaystackProcessing(false)
        return
      }

      setPaymentStatusMessage('Payment is not yet confirmed. Complete checkout and return to this page for automatic verification.')
      setIsPaystackProcessing(false)
    } catch {
      setPaymentError('Unable to verify payment right now. Please try again.')
      setIsPaystackProcessing(false)
    }
  }, [finalizeSubmission, formData])

  const initializeCardPayment = async () => {
    const callbackUrl = new URL(window.location.href)
    callbackUrl.searchParams.set('payment_callback', '1')
    const cardInitPayload = {
      email: formData.email,
      amount: getPaymentAmountNaira(),
      currency: 'NGN',
      callbackUrl: callbackUrl.toString(),
      metadata: {
        plan: getPaymentOption(),
      },
    }
    logPayload('initialize_card:form', formData)
    console.log('[Payload] initialize_card:request_body', cardInitPayload)

    const response = await fetch(`${API_BASE_URL}/api/payments/initialize-card`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cardInitPayload),
    })
    if (!response.ok) {
      throw new Error('Unable to initialize card payment')
    }
    return response.json()
  }

  const handleStep1Submit = (event) => {
    event.preventDefault()
    logPayload('step1_submit', formData)
    const hasValidEmailFormat = /\S+@\S+\.\S+/.test(formData.email.trim())
    if (emailCheckStatus === 'exists' && hasValidEmailFormat) {
      setEmailCheckMessage('This email already exists in our records.')
      return
    }
    if (!event.currentTarget.reportValidity()) {
      return
    }
    setCurrentStep(2)
  }

  const handleStep2Submit = (event) => {
    event.preventDefault()
    logPayload('step2_submit', formData)
    if (!event.currentTarget.reportValidity()) {
      return
    }
    setCurrentStep(3)
  }

  const handleStep3Submit = (event) => {
    event.preventDefault()
    logPayload('step3_submit', formData)
    if (!event.currentTarget.reportValidity()) {
      return
    }
    setPaymentError('')
    setPaymentReference('')
    setPaymentStatusMessage('')
    setFinalizationNotice('')
    setCurrentStep(4) // payment step
  }

  const handleProceedToPayments = async (event) => {
    event.preventDefault()
    logPayload('payment_submit', formData)
    setPaymentError('')
    setPaymentStatusMessage('')
    try {
      setIsPaystackProcessing(true)
      const cardInit = await initializeCardPayment()
      const reference = cardInit?.reference || cardInit?.data?.reference || cardInit?.paymentReference || ''
      const authorizationUrl =
        cardInit?.authorizationUrl ||
        cardInit?.authorization_url ||
        cardInit?.data?.authorization_url ||
        cardInit?.data?.authorizationUrl ||
        cardInit?.paymentLink ||
        cardInit?.data?.paymentLink

      if (!reference) {
        throw new Error('Missing payment reference from card initialization')
      }

      setPaymentReference(reference)
      persistPaymentSession(reference)

      if (authorizationUrl) {
        window.open(authorizationUrl, '_blank', 'noopener,noreferrer')
      }

      setPaymentStatusMessage('Card payment initialized. Complete checkout and return here. Verification will happen automatically.')
    } catch {
      setPaymentError('Could not initialize card payment. Please try again.')
    } finally {
      setIsPaystackProcessing(false)
    }
  }

  const handleStep1Reset = (event) => {
    event.preventDefault()
    setEmailCheckStatus('idle')
    setEmailCheckMessage('')
    setFormData((previous) => ({
      ...previous,
      email: '',
      name: '',
      whatsapp: '',
      expectations: '',
    }))
  }

  const handleStep2Reset = (event) => {
    event.preventDefault()
    setFormData((previous) => ({
      ...previous,
      selectionReason: '',
      referrer: '',
      proficiency: '',
    }))
  }

  const handleStep3Reset = (event) => {
    event.preventDefault()
    setFormData((previous) => ({
      ...previous,
      enrolmentChoice: '',
      trainedBefore: '',
      dailyHours: '',
      paymentChoice: '',
    }))
  }

  const handleStartOver = () => {
    setFormData(initialFormData)
    setPaymentError('')
    setIsPaystackProcessing(false)
    setEmailCheckStatus('idle')
    setEmailCheckMessage('')
    setPaymentReference('')
    setPaymentStatusMessage('')
    setFinalizationNotice('')
    autoCheckedCallbackReferenceRef.current = ''
    clearPaymentSession()
    setCurrentStep(1)
  }

  useEffect(() => {
    if (hasRestoredPaymentSessionRef.current) {
      return
    }
    hasRestoredPaymentSessionRef.current = true

    const url = new URL(window.location.href)
    clearPaymentSession()
    setCurrentStep(1)
    setPaymentReference('')
    setPaymentStatusMessage('')

    if (url.searchParams.has('payment_callback') || url.searchParams.has('reference') || url.searchParams.has('trxref')) {
      url.searchParams.delete('payment_callback')
      url.searchParams.delete('reference')
      url.searchParams.delete('trxref')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  useEffect(() => {
    const emailValue = formData.email.trim()
    if (emailValue.length < 2) {
      setEmailCheckStatus('idle')
      setEmailCheckMessage('')
      return undefined
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      try {
        setEmailCheckStatus('checking')
        setEmailCheckMessage('Checking email...')
        const response = await fetch(
          `${API_BASE_URL}/api/questionnaires/check-email?email=${encodeURIComponent(emailValue)}`,
          { signal: controller.signal },
        )
        if (!response.ok) {
          throw new Error('Could not check email')
        }

        const result = await response.json()
        const exists = Boolean(result?.exists ?? result?.data?.exists ?? result?.found)

        if (exists) {
          setEmailCheckStatus('exists')
          setEmailCheckMessage('This email already exists in our records.')
          return
        }

        setEmailCheckStatus('available')
        setEmailCheckMessage('Email is available.')
      } catch (error) {
        if (error.name === 'AbortError') {
          return
        }
        setEmailCheckStatus('error')
        setEmailCheckMessage('Unable to verify email right now.')
      }
    }, 350)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [formData.email])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 980px)')
    const syncMobileState = (event) => {
      const nextIsMobile = event.matches ?? event.currentTarget.matches
      setIsMobile(nextIsMobile)
      if (!nextIsMobile) {
        setMobileStarted(false)
      }
    }

    syncMobileState(mediaQuery)
    mediaQuery.addEventListener('change', syncMobileState)
    return () => mediaQuery.removeEventListener('change', syncMobileState)
  }, [])

  if (isLoading) {
    return (
      <div className="preloader" role="status" aria-live="polite">
        <img className="preloader-logo" src={logoImage} alt="Loading NextGenForge" />
      </div>
    )
  }

  return (
    <main className="page">
      <section className={`registration-card ${isMobile && mobileStarted ? 'mobile-form-active' : ''}`}>
        {(!isMobile || !mobileStarted) && (
          <aside className="left-panel">
            <img className="brand-logo" src={logoImage} alt="NextGenForge 1.0" />

            <div className="bot-wrap">
              <img className="bot-image" src={botImage} alt="NextGenForge mascot bot" />
            </div>

            <div className="left-copy">
              <h1>Join the Agentic AI Fellowship</h1>
              <p>
                NextGenForge Fellowship is a 3-month hands-on program that teaches
                you how to build AI agents and turn those skills into real income
                opportunities.
              </p>
              <p>
                Whether you are a beginner or looking to pivot into AI, you will
                learn practical skills, work on real projects, and gain a clear path
                to freelancing, jobs, or building your own solutions.
              </p>
            </div>

            {isMobile && (
              <button className="mobile-start-btn" type="button" onClick={() => setMobileStarted(true)}>
                Get Started
              </button>
            )}
          </aside>
        )}

        {(!isMobile || mobileStarted) && (
          <section className="right-panel">
          {isMobile && <img className="mobile-form-logo" src={logoImage} alt="NextGenForge 1.0" />}
          {currentStep === 1 ? (
            <>
              <h2>
                Fill this form to secure your spot
                <br />
                and become a disruptive AI Builder
              </h2>

              <form className="form" onSubmit={handleStep1Submit} onReset={handleStep1Reset}>
                <label htmlFor="email">Email (must be your slack email)</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter email (must be your slack email)"
                  value={formData.email}
                  onChange={handleFieldChange}
                  required
                />
                {emailCheckMessage && (
                  <p className={`field-hint ${emailCheckStatus === 'exists' || emailCheckStatus === 'error' ? 'field-error' : ''}`}>
                    {emailCheckMessage}
                  </p>
                )}

                <label htmlFor="name">
                  Full name <span>(Must be correct as it will be used on your certificate)</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Enter name"
                  value={formData.name}
                  onChange={handleFieldChange}
                  required
                />

                <label htmlFor="whatsapp">Whatsapp number</label>
                <input
                  id="whatsapp"
                  name="whatsapp"
                  type="tel"
                  placeholder="Enter number"
                  value={formData.whatsapp}
                  onChange={handleFieldChange}
                  required
                />

                <label htmlFor="expectations">What are your expectations from NextGenForge?</label>
                <textarea
                  id="expectations"
                  name="expectations"
                  rows="5"
                  placeholder="Enter"
                  value={formData.expectations}
                  onChange={handleFieldChange}
                  required
                ></textarea>

                <div className="form-actions">
                  <button className="clear-btn" type="reset">
                    Clear form
                  </button>
                  <button className="next-btn" type="submit">
                    Next
                  </button>
                </div>
              </form>
            </>
          ) : currentStep === 2 ? (
            <>
              {isMobile && (
                <h2>
                  Fill this form to secure your spot
                  <br />
                  and start your journey into AI.
                </h2>
              )}

              <form className="form step-two-form" onSubmit={handleStep2Submit} onReset={handleStep2Reset}>
                <label htmlFor="selectionReason">
                  We prioritize committed participants. Why should you be selected?
                </label>
                <textarea
                  id="selectionReason"
                  name="selectionReason"
                  rows="6"
                  placeholder="Enter"
                  value={formData.selectionReason}
                  onChange={handleFieldChange}
                  required
                ></textarea>

                <label htmlFor="referrer">Who referred you?</label>
                <input
                  id="referrer"
                  name="referrer"
                  type="text"
                  placeholder="Enter"
                  value={formData.referrer}
                  onChange={handleFieldChange}
                  required
                />

                <fieldset className="proficiency-group">
                  <legend>What is your proficiency level?</legend>

                  <label className="proficiency-option" htmlFor="proficiencyBeginner">
                    <input
                      id="proficiencyBeginner"
                      name="proficiency"
                      type="radio"
                      value="beginner"
                      checked={formData.proficiency === 'beginner'}
                      onChange={handleFieldChange}
                      required
                    />
                    <span>Beginner - No idea on how AI Agents are built</span>
                  </label>

                  <label className="proficiency-option" htmlFor="proficiencyIntermediate">
                    <input
                      id="proficiencyIntermediate"
                      name="proficiency"
                      type="radio"
                      value="intermediate"
                      checked={formData.proficiency === 'intermediate'}
                      onChange={handleFieldChange}
                      required
                    />
                    <span>Intermediate - Have some idea about how Agentic AIs are built</span>
                  </label>

                  <label className="proficiency-option" htmlFor="proficiencyExpert">
                    <input
                      id="proficiencyExpert"
                      name="proficiency"
                      type="radio"
                      value="expert"
                      checked={formData.proficiency === 'expert'}
                      onChange={handleFieldChange}
                      required
                    />
                    <span>Expert - Looking at expanding my skills to be a lot better and monetise</span>
                  </label>
                </fieldset>

                <div className="form-actions">
                  <button className="clear-btn" type="reset">
                    Clear form
                  </button>
                  <button className="next-btn" type="submit">
                    Next
                  </button>
                </div>
              </form>
            </>
          ) : currentStep === 3 ? (
            <>
              {isMobile && (
                <h2>
                  Fill this form to secure your spot
                  <br />
                  and start your journey into AI.
                </h2>
              )}

              <form className="form step-three-form" onSubmit={handleStep3Submit} onReset={handleStep3Reset}>
                <fieldset className="question-group">
                  <legend>Do you want to actively enrol for this batch?</legend>
                  <label className="question-option" htmlFor="enrolNo">
                    <input
                      id="enrolNo"
                      name="enrolmentChoice"
                      type="radio"
                      value="no"
                      checked={formData.enrolmentChoice === 'no'}
                      onChange={handleFieldChange}
                      required
                    />
                    <span>No</span>
                  </label>
                  <label className="question-option" htmlFor="enrolYes">
                    <input
                      id="enrolYes"
                      name="enrolmentChoice"
                      type="radio"
                      value="yes"
                      checked={formData.enrolmentChoice === 'yes'}
                      onChange={handleFieldChange}
                      required
                    />
                    <span>Yes</span>
                  </label>
                </fieldset>

                <fieldset className="question-group">
                  <legend>Have you ever been trained on any Agentic AI platform before?</legend>
                  <label className="question-option" htmlFor="trainedYes">
                    <input
                      id="trainedYes"
                      name="trainedBefore"
                      type="radio"
                      value="yes"
                      checked={formData.trainedBefore === 'yes'}
                      onChange={handleFieldChange}
                      required
                    />
                    <span>Yes</span>
                  </label>
                  <label className="question-option" htmlFor="trainedNo">
                    <input
                      id="trainedNo"
                      name="trainedBefore"
                      type="radio"
                      value="no"
                      checked={formData.trainedBefore === 'no'}
                      onChange={handleFieldChange}
                      required
                    />
                    <span>No</span>
                  </label>
                  <label className="question-option" htmlFor="trainedMaybe">
                    <input
                      id="trainedMaybe"
                      name="trainedBefore"
                      type="radio"
                      value="maybe"
                      checked={formData.trainedBefore === 'maybe'}
                      onChange={handleFieldChange}
                      required
                    />
                    <span>Maybe</span>
                  </label>
                </fieldset>

                <fieldset className="question-group">
                  <legend>How many hours can you commit to training per day?</legend>
                  <label className="question-option" htmlFor="hoursOne">
                    <input
                      id="hoursOne"
                      name="dailyHours"
                      type="radio"
                      value="1hr"
                      checked={formData.dailyHours === '1hr'}
                      onChange={handleFieldChange}
                      required
                    />
                    <span>1hr</span>
                  </label>
                  <label className="question-option" htmlFor="hoursTwo">
                    <input
                      id="hoursTwo"
                      name="dailyHours"
                      type="radio"
                      value="2hrs"
                      checked={formData.dailyHours === '2hrs'}
                      onChange={handleFieldChange}
                      required
                    />
                    <span>2hrs</span>
                  </label>
                  <label className="question-option" htmlFor="hoursMore">
                    <input
                      id="hoursMore"
                      name="dailyHours"
                      type="radio"
                      value="2hrPlus"
                      checked={formData.dailyHours === '2hrPlus'}
                      onChange={handleFieldChange}
                      required
                    />
                    <span>2hr +</span>
                  </label>
                </fieldset>

                <fieldset className="question-group payment-group">
                  <legend>This is a paid program ($50). Are you ready to proceed with payment?</legend>
                  <p>Once we receive your payment, you will be added automatically to our slack channel</p>
                  <label className="question-option" htmlFor="paymentReady">
                    <input
                      id="paymentReady"
                      name="paymentChoice"
                      type="radio"
                      value="earlyRegistration"
                      checked={formData.paymentChoice === 'earlyRegistration'}
                      onChange={handleFieldChange}
                      required
                    />
                    <span>Yes I'm ready - US$50 (Early Registration)</span>
                  </label>
                  <label className="question-option" htmlFor="paymentInstallment">
                    <input
                      id="paymentInstallment"
                      name="paymentChoice"
                      type="radio"
                      value="installment"
                      checked={formData.paymentChoice === 'installment'}
                      onChange={handleFieldChange}
                      required
                    />
                    <span>Can I pay on Installment - US$30</span>
                  </label>
                  <label className="question-option" htmlFor="paymentTeam">
                    <input
                      id="paymentTeam"
                      name="paymentChoice"
                      type="radio"
                      value="team"
                      checked={formData.paymentChoice === 'team'}
                      onChange={handleFieldChange}
                      required
                    />
                    <span>Pay for a team of three - US$120</span>
                  </label>
                </fieldset>

                <div className="form-actions">
                  <button className="clear-btn" type="reset">
                    Clear form
                  </button>
                  <button className="next-btn" type="submit">
                    {isMobile ? 'Next' : 'Done'}
                  </button>
                </div>
              </form>
            </>
          ) : currentStep === 4 ? (
            <section className="payment-view">
              {isMobile && (
                <>
                  <h2>
                    Complete your payment
                    <br />
                    to secure your seat.
                  </h2>
                  <p className="payment-subtitle">Confirm your payment details to complete your registration.</p>
                </>
              )}

              {!isMobile && (
                <>
                  <h2>Complete your payment to secure your seat.</h2>
                  <p className="payment-subtitle">Confirm your payment details to complete your registration.</p>
                </>
              )}

              <form className="form payment-form" onSubmit={handleProceedToPayments}>
                  <label htmlFor="paymentEmail">Payment email</label>
                  <input
                    id="paymentEmail"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleFieldChange}
                    required
                    placeholder="Enter email"
                  />

                  <label htmlFor="paymentPlan">Payment option</label>
                  <input
                    id="paymentPlan"
                    type="text"
                    value={
                      formData.paymentChoice === 'installment'
                        ? 'Installment - US$30'
                        : formData.paymentChoice === 'team'
                          ? 'Team payment - US$120'
                          : 'Early registration - US$50'
                    }
                    readOnly
                  />

                  <label htmlFor="paymentAmount">Amount</label>
                  <input id="paymentAmount" type="text" value={`NGN ${formatNairaAmount(getPaymentAmountNaira())}`} readOnly />

                  <label htmlFor="paymentMethod">Payment method</label>
                  <input id="paymentMethod" type="text" value="Card" readOnly />

                  {paymentError && <p className="payment-error">{paymentError}</p>}
                  {paymentStatusMessage && <p className="field-hint">{paymentStatusMessage}</p>}

                  <div className="form-actions payment-actions">
                    <button className="clear-btn" type="button" onClick={() => setCurrentStep(3)}>
                      Back
                    </button>
                    <button className="next-btn" type="submit" disabled={isPaystackProcessing}>
                      {isPaystackProcessing ? 'Preparing...' : 'Proceed to Payments'}
                    </button>
                  </div>
              </form>

            </section>
          ) : (
            <section className="success-view" aria-live="polite">
              {isMobile && <img className="mobile-form-logo" src={logoImage} alt="NextGenForge 1.0" />}
              <p className="success-kicker">Registration completed</p>
              <h2>Success! Your details were submitted.</h2>
              <p className="success-text">
                Thanks {formData.name || 'there'} - your payment is confirmed and our team will reach out with
                next steps shortly.
              </p>
              {finalizationNotice && <p className="field-hint">{finalizationNotice}</p>}
              <button className="next-btn" type="button" onClick={handleStartOver}>
                Start Over
              </button>
            </section>
          )}
          </section>
        )}
      </section>
    </main>
  )
}

export default App
